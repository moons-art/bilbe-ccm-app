import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fsPromises from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import url from 'node:url';

const CLIENT_ID = '786503545807-07apkofb1efp1fe443hi1tnjbtfkblst.apps.googleusercontent.com'; 
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:5005';

export class GDriveService {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;

  constructor(appDataPath: string) {
    this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    this.tokenPath = path.join(appDataPath, 'gdrive-token.json');
  }

  async getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file']
    });
  }

  async waitForAuthCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const queryObject = url.parse(req.url || '', true).query;
          const code = queryObject.code as string;

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f8fafc;">
                  <div style="background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                    <h1 style="color: #10b981;">✅ 인증 성공!</h1>
                    <p style="color: #64748b;">인증 코드가 앱으로 전달되었습니다. 이 창을 닫고 앱으로 돌아가세요.</p>
                  </div>
                </body>
              </html>
            `);
            resolve(code);
            server.close();
          }
        } catch (e) {
          reject(e);
          server.close();
        }
      }).listen(5005, () => {
        console.log('Auth server listening on port 5005');
      });

      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timed out'));
      }, 300000);
    });
  }

  async setToken(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    await fsPromises.writeFile(this.tokenPath, JSON.stringify(tokens));
    return tokens;
  }

  async loadSavedCredentials() {
    try {
      const content = await fsPromises.readFile(this.tokenPath, 'utf8');
      const tokens = JSON.parse(content);
      this.oauth2Client.setCredentials(tokens);
      return true;
    } catch (err) {
      return false;
    }
  }

  async syncFiles(hymnalDirPath: string, albumId: string = 'all', albums: any[] = []) {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    
    // 1. Base Folder 관리
    let rootFolderId = await this.findFolder(drive, 'CEUM_Hymnal_Data');
    if (!rootFolderId) {
      rootFolderId = await this.createFolder(drive, 'CEUM_Hymnal_Data');
    }

    // 2. music_data.json 업로드 (메타데이터 최신화)
    const dbFilePath = path.join(hymnalDirPath, 'music_data.json');
    if (fs.existsSync(dbFilePath)) {
      console.log('[GDrive] Syncing music_data.json...');
      await this.uploadFile(drive, dbFilePath, 'application/json', rootFolderId);
    }

    // 3. 대상 앨범 정보 및 폴더 확정
    const foldersToProcess: { id: string, albumId: string }[] = [];
    
    // 앨범 목록을 순회하며 동기화 대상 결정
    for (const album of albums) {
      if (albumId === 'all' || albumId === album.id) {
        // 드라이브에 해당 앨범 이름으로 폴더 생성/찾기
        const folderId = await this.getOrCreateFolder(drive, album.name, rootFolderId);
        foldersToProcess.push({ id: folderId, albumId: album.id });
      }
    }

    // 4. 데이터 로드
    const content = await fsPromises.readFile(dbFilePath, 'utf8');
    const musicData = JSON.parse(content);
    const localFilenames = new Set(musicData.map((s: any) => path.basename(s.filename || s.filePath || '')));
    const remoteFilesByAlbum: { [key: string]: any[] } = {};

    // 5. [청소] 각 앨범 폴더의 실태 조사 및 유령 파일 제거
    for (const folder of foldersToProcess) {
      console.log(`[GDrive] Syncing Album: ${folder.albumId} (Folder: ${folder.id})`);
      const resp = await drive.files.list({
        q: `'${folder.id}' in parents and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1000
      });
      const remoteFiles = resp.data.files || [];
      remoteFilesByAlbum[folder.albumId] = remoteFiles;

      // 드라이브에는 있는데 로컬 DB에는 없는 파일 삭제 (정리)
      for (const file of remoteFiles) {
        if (!localFilenames.has(file.name!)) {
          console.log(`[GDrive] Cleanup: Trashing stale file ${file.name} from Drive.`);
          await drive.files.update({
            fileId: file.id!,
            requestBody: { trashed: true }
          }).catch(() => {});
        }
      }
    }

    // 6. 이미지 파일 동기화 (이미 정리가 끝난 상태에서 부족한 것만 업로드)
    let uploadCount = 0;
    let skipCount = 0;
    let totalCount = 0;

    // 앨범 ID와 폴더 ID를 연결하는 맵 생성 (빠른 조회를 위해)
    const albumFolderMap = new Map(foldersToProcess.map(f => [f.albumId, f.id]));

    for (const song of musicData) {
      if (!song.filePath) continue;
      
      // 곡의 소속 앨범 ID 추출 (id가 "{albumId}-..." 형식)
      const songId = (song.id || '').toLowerCase();
      let targetAlbumId = '';
      
      // 어떤 앨범 소속인지 확인
      for (const album of albums) {
        if (songId.startsWith(`${album.id.toLowerCase()}-`)) {
          targetAlbumId = album.id;
          break;
        }
      }

      // 소속을 알 수 없거나, 현재 동기화 대상이 아니면 건너뜐
      if (!targetAlbumId) continue;
      if (albumId !== 'all' && albumId !== targetAlbumId) continue;

      const targetFolderId = albumFolderMap.get(targetAlbumId);
      if (!targetFolderId) continue;

      totalCount++;
      const fileName = path.basename(song.filePath);
      const localFilePath = path.join(hymnalDirPath, 'hymnal_images', fileName);
      
      // 드라이브에 이미 있는지 확인 (고속 대조)
      const isAlreadyOnDrive = remoteFilesByAlbum[targetAlbumId]?.some(f => f.name === fileName);

      if (fs.existsSync(localFilePath)) {
        if (!isAlreadyOnDrive) {
          try {
            console.log(`[GDrive] [${targetAlbumId}] Uploading: ${fileName} to folder ${targetFolderId}`);
            await this.uploadFile(drive, localFilePath, 'image/webp', targetFolderId);
            uploadCount++;
          } catch (err) {
            console.error(`[GDrive] Failed to upload: ${fileName}`, err);
          }
        } else {
          skipCount++;
        }
      } else {
        console.warn(`[GDrive] Local file missing: ${localFilePath}`);
      }
    }
    console.log(`[GDrive] Finished! AlbumId: ${albumId}, Uploaded: ${uploadCount}, Skipped: ${skipCount}`);
    
    return {
      uploaded: uploadCount,
      skipped: skipCount,
      total: totalCount
    };
  }

  private async getOrCreateFolder(drive: any, name: string, parentId: string) {
    const res = await drive.files.list({
      q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });
    const existing = res.data.files || [];
    if (existing.length > 0) return existing[0].id;
    return await this.createFolder(drive, name, parentId);
  }

  private async findFolder(drive: any, name: string) {
    const res = await drive.files.list({
      q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });
    return res.data.files[0]?.id;
  }

  private async createFolder(drive: any, name: string, parentId?: string) {
    const res = await drive.files.create({
      resource: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : []
      },
      fields: 'id',
    });
    return res.data.id;
  }

  private async uploadFile(drive: any, filePath: string, mimeType: string, parentId: string) {
    const fileName = path.basename(filePath);
    const contentStream = fs.createReadStream(filePath);

    const existingFileRes = await drive.files.list({
      q: `name='${fileName}' and '${parentId}' in parents and trashed=false`,
      fields: 'files(id)',
    });

    const existingFiles = existingFileRes.data.files || [];

    if (existingFiles.length > 0) {
      // 업데이트 (v3에서는 fileId가 필요)
      await drive.files.update({
        fileId: existingFiles[0].id,
        media: {
          mimeType,
          body: contentStream,
        },
      });
    } else {
      // 신규 생성
      await drive.files.create({
        resource: {
          name: fileName,
          parents: [parentId],
        },
        media: {
          mimeType,
          body: contentStream,
        },
        fields: 'id',
      });
    }
  }

  private async downloadFile(drive: any, fileId: string, destPath: string) {
    const dest = fs.createWriteStream(destPath);
    
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      // responseType: 'stream'인 경우 res.data가 스트림입니다.
      res.data
        .on('error', (err: any) => {
          console.error('Drive download stream error:', err);
          reject(err);
        })
        .pipe(dest);
      
      dest.on('finish', () => {
        console.log(`Downloaded file to ${destPath}`);
        resolve(true);
      });
      
      dest.on('error', (err: any) => {
        console.error('Local write stream error:', err);
        reject(err);
      });
    });
  }
}
