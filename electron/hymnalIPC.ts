import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import * as XLSX from 'xlsx';
import { GDriveService } from './gdriveService';

export function registerHymnalIPC(win: BrowserWindow) {
  const hymnalDir = path.join(app.getPath('userData'), 'hymnal');
  const imagesDir = path.join(hymnalDir, 'hymnal_images');
  const dbPath = path.join(hymnalDir, 'music_data.json');
  
  const gdrive = new GDriveService(app.getPath('userData'));
  const settingsPath = path.join(hymnalDir, 'settings.json');
  
  // DB 경로 터미널 출력
  console.log(`[Hymnal] Database Path: ${dbPath}`);
  
  // 설정 정보 로드/프리셋 (신규: 다중 앨범 마이그레이션 적용)
  const getSettings = async () => {
    try {
      const data = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(data);
      
      // 구 버전 마이그레이션 (hymnalPath, ccmPath가 있는 경우)
      if (!settings.albums) {
        settings.albums = [
          { id: 'hymnal', name: '찬송가', path: settings.hymnalPath || '', type: 'fixed' },
          { id: 'ccm', name: 'CCM', path: settings.ccmPath || '', type: 'fixed' }
        ];
        delete settings.hymnalPath;
        delete settings.ccmPath;
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      }
      return settings;
    } catch {
      // 초기 설정
      return { 
        albums: [
          { id: 'hymnal', name: '찬송가', path: '', type: 'fixed' },
          { id: 'ccm', name: 'CCM', path: '', type: 'fixed' }
        ]
      };
    }
  };

// 파일명 안전하게 변환 (한글/영문/숫자 보존, 중복 방지를 위해 식별자 추가)
const sanitizeFilename = (num: number, title: string, id?: string) => {
  // 한글 자모 분리 방지 (NFC 정규화) 및 특수문자 제거
  const normalizedTitle = (title || '').normalize('NFC');
  const clean = normalizedTitle.replace(/[^가-힣a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 30);
  
  // 중복 방지를 위한 고유 식별자 추가 (ID의 마지막 4자리 정도)
  const uniqueId = id ? `_${id.slice(-4)}` : '';
  
  return `${num}_${clean}${uniqueId}.webp`;
};


  // Get All Songs from userData (With dynamic migration)
  ipcMain.handle('hymnal:get-songs', async () => {
    try {
      const content = await fs.readFile(dbPath, 'utf8');
      let musicData = JSON.parse(content);
      let changed = false;

      // 파일명 최적화 및 마이그레이션 (너무 길거나 특수문자가 있는 경우, 고유 ID 포함)
      for (let song of musicData) {
        // 모든 텍스트 필드를 NFC로 정규화하여 자모 분리 방지
        if (song.title) song.title = song.title.normalize('NFC');
        if (song.lyrics) song.lyrics = song.lyrics.normalize('NFC');
        if (song.category) song.category = song.category.normalize('NFC');

        if (song.filename) {
          const expectedName = sanitizeFilename(song.number, song.title, song.id);
          if (song.filename !== expectedName) {
            const oldPath = path.join(imagesDir, song.filename);
            const newPath = path.join(imagesDir, expectedName);
            
            try {
              const oldExists = await fs.stat(oldPath).then(() => true).catch(() => false);
              if (oldExists) {
                await fs.rename(oldPath, newPath);
                song.filename = expectedName;
                song.filePath = `hymnal_images/${expectedName}`;
                changed = true;
              } else {
                // 이미 이름이 변경되었거나 파일이 없는 경우, DB 필드라도 동기화
                song.filename = expectedName;
                song.filePath = `hymnal_images/${expectedName}`;
                changed = true;
              }
            } catch (err) {
              console.error(`Failed to migrate filename: ${song.filename}`, err);
            }
          }
        }
      }

      if (changed) {
        await fs.writeFile(dbPath, JSON.stringify(musicData, null, 2), 'utf-8');
      }

      return musicData;
    } catch (err) {
      return [];
    }
  });

  // Folder Selection
  ipcMain.handle('hymnal:select-folder', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    });
    return result.filePaths[0];
  });

  // Settings API
  // 앨범 관리 API 신설
  ipcMain.handle('hymnal:add-album', async (_, album) => {
    const settings = await getSettings();
    const newAlbum = {
      ...album,
      id: `album-${Date.now()}`,
      type: 'custom'
    };
    settings.albums.push(newAlbum);
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true, album: newAlbum };
  });

  ipcMain.handle('hymnal:update-album', async (_, updatedAlbum) => {
    const settings = await getSettings();
    const idx = settings.albums.findIndex((a: any) => a.id === updatedAlbum.id);
    if (idx !== -1) {
      settings.albums[idx] = { ...settings.albums[idx], ...updatedAlbum };
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      return { success: true };
    }
    return { success: false, error: 'Album not found' };
  });

  ipcMain.handle('hymnal:delete-album', async (_, albumId) => {
    const settings = await getSettings();
    const albumToDelete = settings.albums.find((a: any) => a.id === albumId);
    if (!albumToDelete || albumToDelete.type === 'fixed') {
      return { success: false, error: 'Cannot delete fixed album' };
    }

    settings.albums = settings.albums.filter((a: any) => a.id !== albumId);
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    // DB 데이터에서도 해당 앨범 곡들 삭제
    try {
      const content = await fs.readFile(dbPath, 'utf8');
      let musicData = JSON.parse(content);
      const prefix = `${albumId}-`;
      musicData = musicData.filter((s: any) => !s.id.startsWith(prefix));
      await fs.writeFile(dbPath, JSON.stringify(musicData, null, 2), 'utf-8');
    } catch {}

    return { success: true };
  });

  // Settings API
  ipcMain.handle('hymnal:get-settings', async () => await getSettings());
  ipcMain.handle('hymnal:save-settings', async (_, settings) => {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  });

  // Image Processing & OCR (범용 앨범 모드 지원)
  ipcMain.handle('hymnal:process-images', async (_event, { albumId, sourcePath, isIncremental }: { albumId: string, sourcePath: string, isIncremental?: boolean }) => {
    if (!sourcePath) return { success: false, error: 'Source path is missing' };
    
    // 이 앨범이 찬송가인지 확인 (마스터 데이터 로드를 위해)
    const isHymnal = albumId === 'hymnal';
    const isCCM = albumId === 'ccm';

    try {
      const files = await fs.readdir(sourcePath);
      const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp|bmp)$/i.test(f));
      const total = imageFiles.length;
      let processedCount = 0;

      // Load existing data
      let musicData: any[] = [];
      try {
        const content = await fs.readFile(dbPath, 'utf8');
        musicData = JSON.parse(content);
      } catch (err) {
        musicData = [];
      }

      // Load Master Data if in hymnal mode
      let masterData: Record<number, any> = {};
      if (isHymnal) {
        try {
          const xlsxPath = path.join(process.cwd(), 'hymnal_master_data.xlsx');
          const fileBuf = await fs.readFile(xlsxPath);
          const workbook = XLSX.read(fileBuf, { type: 'buffer' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const sheetData: any[] = XLSX.utils.sheet_to_json(firstSheet);
          
          sheetData.forEach(row => {
            const num = parseInt(row['장'] || row['번호'] || row['number'] || row['no'], 10);
            if (num) {
              masterData[num] = { 
                title: (row['제목'] || row['title'] || '').toString(), 
                category: (row['분류'] || row['주제'] || row['구분'] || row['category'] || '').toString(),
                code: (row['코드'] || row['code'] || '').toString(),
                meter: (row['박자'] || row['meter'] || '').toString(),
                lyrics: (row['가사'] || row['lyrics'] || '').toString()
              };
            }
          });
          console.log(`[Hymnal] Loaded ${Object.keys(masterData).length} master records from XLSX`);
        } catch (err) {
          console.error('Failed to load XLSX master data', err);
        }
      }

      for (const file of imageFiles) {
        try {
          const fileNameOnly = path.parse(file).name;
          const songNumber = parseInt(fileNameOnly.match(/\d+/)?.[0] || '0', 10);
          const existingSongIdx = musicData.findIndex(s => s.originalFilename === file);
          const existingSong = existingSongIdx !== -1 ? musicData[existingSongIdx] : null;

          // 수동 수정본(isManual) 보호
          if (existingSong?.isManual) {
            processedCount++;
            continue;
          }

          // 제목 및 파일명 최적화 (기본은 파일명에서 추출)
          // Mac 환경 자모 분리 방지를 위해 NFC 정규화 적용
          let title = (existingSong?.title || (/[가-힣]/.test(fileNameOnly) ? fileNameOnly.replace(/[0-9]/g, '').trim() : fileNameOnly)).normalize('NFC');
          let lyrics = existingSong?.lyrics || '';
          let code = existingSong?.code || '';
          let meter = existingSong?.meter || '';
          let category = existingSong?.category || '';

          // 찬송가인 경우 엑셀 마스터 데이터에서 정보 보강
          if (isHymnal) {
            if (songNumber && masterData[songNumber]) {
              const info = masterData[songNumber];
              title = (info.title || title || fileNameOnly).toString();
              lyrics = (info.lyrics || lyrics).toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
              code = (info.code || code).toString();
              meter = (info.meter || meter).toString();
              category = (info.category || category).toString(); 
            }
          }

          const songId = existingSong?.id || `${albumId}-${songNumber || Date.now()}-${processedCount}`;
          const newFileName = sanitizeFilename(songNumber, title || fileNameOnly, songId);
          const outputFilePath = path.join(imagesDir, newFileName);
          
          // 증분 빌드 체크: 이미 결과 파일이 있고 isIncremental이 true면 sharp 과정을 건너뜀
          const outputExists = await fs.access(outputFilePath).then(() => true).catch(() => false);
          
          if (!(isIncremental && outputExists && existingSong)) {
            const sourceFilePath = path.join(sourcePath, file);
            await sharp(sourceFilePath)
              .sharpen({ sigma: 1.0 }) 
              .webp({ quality: 100, lossless: true }) 
              .toFile(outputFilePath);
          }

          const newSong = {
            id: songId,
            number: songNumber,
            title: title || fileNameOnly,
            lyrics: lyrics,
            code: code,
            meter: meter,
            filename: newFileName,
            filePath: `hymnal_images/${newFileName}`,
            originalFilename: file,
            category: category,
            isManual: false
          };

          if (existingSongIdx !== -1) {
            musicData[existingSongIdx] = newSong;
          } else {
            musicData.push(newSong);
          }

          processedCount++;
          win.webContents.send('hymnal:process-progress', { processed: processedCount, total });
        } catch (err) {
          console.error(`Failed to process ${file}:`, err);
        }
      }

      // [추가] 로컬 데이터 대청소: 폴더에 없는 유령 데이터 삭제
      // 현재 앨범에 해당하는 곡들만 필터링하여 체크
      const currentPrefix = `${albumId}-`;
      const sourceFiles = new Set(imageFiles); // 현재 폴더에 있는 실제 파일 목록
      
      musicData = musicData.filter((song: any) => {
        // 다른 앨범의 곡은 건드리지 않음
        const isCurrentAlbum = song.id.startsWith(currentPrefix);
        if (!isCurrentAlbum) return true;

        // 현재 폴더에 실제 원본 파일이 있는지 확인
        const fileExists = sourceFiles.has(song.originalFilename);
        if (!fileExists) {
          console.log(`[Hymnal] Removing ghost entry from local DB: ${song.title} (${song.originalFilename})`);
        }
        return fileExists;
      });

      await fs.writeFile(dbPath, JSON.stringify(musicData, null, 2), 'utf-8');
      return { success: true, count: imageFiles.length, processed: processedCount };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Google Drive Sync
  ipcMain.handle('hymnal:get-auth-url', async () => {
    return await gdrive.getAuthUrl();
  });

  ipcMain.handle('hymnal:wait-for-auth-code', async () => {
    try {
      return await gdrive.waitForAuthCode();
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('hymnal:confirm-auth', async (_, code) => {
    return await gdrive.setToken(code);
  });

  ipcMain.handle('hymnal:sync-gdrive', async (_, albumId: string = 'all') => {
    try {
      const hasToken = await gdrive.loadSavedCredentials();
      if (!hasToken) return { success: false, message: 'Need Auth' };
      
      // 데이터 상태 로그 추가
      try {
        const content = await fs.readFile(dbPath, 'utf8');
        const data = JSON.parse(content);
        const ccmCount = data.filter((s: any) => (s.id || '').toLowerCase().startsWith('ccm-')).length;
        const hymnalCount = data.length - ccmCount;
        console.log(`[Hymnal] Sync Triggered: AlbumId=${albumId}, Total=${data.length}, Hymnal=${hymnalCount}, CCM=${ccmCount}`);
      } catch (e) {}

      const settings = await getSettings();
      const syncResult = await gdrive.syncFiles(hymnalDir, albumId, settings.albums); 
      return { success: true, ...syncResult };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  // 개별 곡 정보 수정 API (수정 즉시 실제 파일명도 변경 & 수동 수정 보호)
  ipcMain.handle('hymnal:update-song', async (_, updatedSong) => {
    try {
      const content = await fs.readFile(dbPath, 'utf8');
      let musicData = JSON.parse(content);
      const index = musicData.findIndex((s: any) => s.id === updatedSong.id);
      
      if (index !== -1) {
        const oldSong = musicData[index];
        // 제목이나 번호가 바뀌었으면 물리 파일명도 변경
        if (updatedSong.title !== undefined || updatedSong.number !== undefined) {
          const newTitle = updatedSong.title !== undefined ? updatedSong.title : oldSong.title;
          const newNumber = updatedSong.number !== undefined ? updatedSong.number : oldSong.number;
          const newFileName = sanitizeFilename(newNumber, newTitle, oldSong.id);
          
          if (oldSong.filename !== newFileName) {
            const oldPath = path.join(imagesDir, oldSong.filename);
            const newPath = path.join(imagesDir, newFileName);
            
            try {
              const oldExists = await fs.stat(oldPath).then(() => true).catch(() => false);
              if (oldExists) {
                await fs.rename(oldPath, newPath);
                updatedSong.filename = newFileName;
                updatedSong.filePath = `hymnal_images/${newFileName}`;
              } else {
                updatedSong.filename = newFileName;
                updatedSong.filePath = `hymnal_images/${newFileName}`;
              }
            } catch (err) {
              console.error('Failed to rename file on update', err);
            }
          }
        }

        musicData[index] = { 
          ...oldSong, 
          ...updatedSong, 
          isManual: updatedSong.isManual !== undefined ? updatedSong.isManual : true 
        };
        await fs.writeFile(dbPath, JSON.stringify(musicData, null, 2), 'utf-8');
        return { success: true };
      }
      return { success: false, error: 'Song not found' };
    } catch (err: any) {
      return { success: false, error: 'Failed to update song: ' + err.message };
    }
  });

  // CSV 내보내기 (Excel 호환 UTF-8 BOM 및 NFC 정규화 적용)
  ipcMain.handle('hymnal:export-csv', async (_event, { mode }: { mode?: string }) => {
    try {
      const content = await fs.readFile(dbPath, 'utf8');
      const data = JSON.parse(content);
      
      let filteredData = data;
      if (mode === 'hymnal') {
        filteredData = data.filter((s: any) => s.id.startsWith('hymnal-'));
      } else if (mode === 'ccm') {
        filteredData = data.filter((s: any) => s.id.startsWith('ccm-'));
      }

      const header = ['ID', '번호', '제목', '코드', '박자', '가사', '카테고리', '파일명'].join(',');
      const rows = filteredData.map((s: any) => {
        const fields = [
          s.id,
          s.number,
          s.title,
          s.code,
          s.meter,
          s.lyrics,
          s.category,
          s.filename
        ].map(val => {
          let str = (val === undefined || val === null ? '' : val).toString();
          
          // Mac-Windows 한글 자모 분리 방지 (NFC 정규화)
          str = str.normalize('NFC');

          // Excel 수식 오인 방지 (#NAME? 오류 해결)
          if (str.startsWith('=') || str.startsWith('-') || str.startsWith('+')) {
            str = "'" + str; 
          }

          // CSV 필드 이중 따옴표 및 줄바꿈 처리
          return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        });
        return fields.join(',');
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const defaultFilename = `hymnal_data_${mode || 'all'}_${dateStr}.csv`;

      const { filePath } = await dialog.showSaveDialog(win, {
        title: '데이터 내보내기',
        defaultPath: path.join(app.getPath('downloads'), defaultFilename),
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      });

      if (!filePath) return { success: false };

      const csvContent = '\ufeff' + [header, ...rows].join('\n'); // UTF-8 BOM
      await fs.writeFile(filePath, csvContent, 'utf-8');
      return { success: true, path: filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // CSV 가져오기
  ipcMain.handle('hymnal:import-csv', async () => {
    const { filePaths } = await dialog.showOpenDialog(win, {
      title: '데이터 가져오기',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (filePaths.length === 0) return { success: false };

    try {
      const csvRaw = await fs.readFile(filePaths[0], 'utf8');
      // Simple CSV parsing (Skipping headers)
      const rows = csvRaw.split('\n').filter(r => r.trim()).slice(1);
      
      const importedData = rows.map(row => {
        // More robust CSV parsing (handles quotes and commas)
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"' && row[i+1] === '"') { current += '"'; i++; }
          else if (char === '"') { inQuotes = !inQuotes; }
          else if (char === ',' && !inQuotes) { parts.push(current); current = ''; }
          else { current += char; }
        }
        parts.push(current);

        const cleanStr = (s: string | undefined) => s ? s.trim() : '';
        
        return {
          id: cleanStr(parts[0]),
          number: parseInt(cleanStr(parts[1]), 10) || 0,
          title: cleanStr(parts[2]),
          code: cleanStr(parts[3]),
          meter: cleanStr(parts[4]),
          lyrics: cleanStr(parts[5]),
          category: cleanStr(parts[6]),
          filename: cleanStr(parts[7])
        };
      });

      // Merge or Overwrite? Let's use Merge by ID/Number
      const currentContent = await fs.readFile(dbPath, 'utf8');
      let currentData = JSON.parse(currentContent);

      importedData.forEach(item => {
        const idx = currentData.findIndex((s: any) => s.id === item.id || (s.number === item.number && s.number !== 0));
        if (idx !== -1) {
          currentData[idx] = { ...currentData[idx], ...item };
        } else {
          currentData.push(item);
        }
      });

      await fs.writeFile(dbPath, JSON.stringify(currentData, null, 2), 'utf-8');
      return { success: true, count: currentData.length };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 악보 삭제 API (PC 원본 파일 삭제 & 앱 데이터 삭제)
  // 악보 삭제 API (PC 원본 파일 삭제 선택권 부여 & 앱 데이터 삭제)
  ipcMain.handle('hymnal:delete-song', async (_, { songId, shouldDeleteOriginal }) => {
    try {
      const content = await fs.readFile(dbPath, 'utf8');
      let musicData = JSON.parse(content);
      const songIndex = musicData.findIndex((s: any) => s.id === songId);
      
      if (songIndex === -1) return { success: false, error: 'Song not found' };
      
      const song = musicData[songIndex];
      const settings = await getSettings();
      
      // 1. 곡 ID에 해당하는 앨범 찾기 (더 정교한 매칭: 앨범 ID + '-'로 시작하는지 확인)
      const targetAlbum = settings.albums.find((a: any) => songId.startsWith(a.id + '-'));
      const sourceFolder = targetAlbum?.path;
      
      // 사용자가 원본 삭제를 선택했을 때만 실제 파일 삭제 진행
      if (shouldDeleteOriginal && sourceFolder && song.originalFilename) {
        const originalPath = path.join(sourceFolder, song.originalFilename);
        console.log(`[Hymnal] User chose to delete original file: ${originalPath}`);
        
        try {
          // 일차적으로 휴지통으로 이동 시도
          await shell.trashItem(originalPath);
          console.log(`[Hymnal] Successfully moved original to trash: ${originalPath}`);
        } catch (err) {
          console.warn(`[Hymnal] trashItem failed for ${originalPath}, attempting unlink...`, err);
          try {
            await fs.unlink(originalPath);
            console.log(`[Hymnal] Unlinked original file: ${originalPath}`);
          } catch (unlinkErr: any) {
            console.error(`[Hymnal] Failed to delete original: ${unlinkErr.message}`);
          }
        }
      } else {
        console.log(`[Hymnal] Keeping original file for song: ${song.title}`);
      }

      // 2. 처리된 .webp 악보 이미지 삭제 (앱 캐시는 항상 삭제)
      if (song.filename) {
        const processedPath = path.join(imagesDir, song.filename);
        try {
          await fs.unlink(processedPath).catch(() => {});
        } catch (err) {}
      }

      // 3. 데이터베이스에서 제거
      musicData.splice(songIndex, 1);
      await fs.writeFile(dbPath, JSON.stringify(musicData, null, 2), 'utf-8');
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Failed to delete song: ' + err.message };
    }
  });

  ipcMain.on('hymnal:open-external', (_, url) => {
    shell.openExternal(url);
  });
}
