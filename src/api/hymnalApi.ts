import { gdriveWebService } from './gdriveWebService';

export const hymnalApi = {
  getSettings: async () => {
    try {
      const data = await gdriveWebService.downloadJsonFile('settings.json');
      if (data && data.albums) {
        return data;
      }
      throw new Error('No settings');
    } catch (e) {
      return { 
        albums: [
          { id: 'hymnal', name: '새찬송가', type: 'system' },
          { id: 'misc', name: '기타파일앨범', type: 'system' }
        ] 
      };
    }
  },
  
  saveSettings: async (settings: any) => {
    try {
      await gdriveWebService.uploadJsonFile('settings.json', settings);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  getSongs: async () => {
    try {
      const data = await gdriveWebService.downloadJsonFile('music_data.json');
      if (data && data.length > 0) return data;
      
      try {
        const defaultResponse = await fetch('/data/hymnal_default.json');
        if (defaultResponse.ok) {
          const defaultData = await defaultResponse.json();
          await gdriveWebService.uploadJsonFile('music_data.json', defaultData).catch(() => {});
          return defaultData;
        }
      } catch (err) {
        console.warn('Failed to load default hymnal data', err);
      }
      return [];
    } catch (e) {
      try {
        const defaultResponse = await fetch('/data/hymnal_default.json');
        if (defaultResponse.ok) {
          return await defaultResponse.json();
        }
      } catch (err) {}
      return [];
    }
  },

  addAlbum: async (album: any) => {
    const settings = await hymnalApi.getSettings();
    const newAlbum = { ...album, id: `album-${Date.now()}`, type: 'custom' };
    settings.albums = settings.albums || [];
    settings.albums.push(newAlbum);
    const saveResult = await hymnalApi.saveSettings(settings);
    if (!saveResult.success) return saveResult;
    return { success: true, album: newAlbum };
  },

  updateAlbum: async (album: any) => {
    const settings = await hymnalApi.getSettings();
    const idx = settings.albums.findIndex((a: any) => a.id === album.id);
    if (idx !== -1) {
      settings.albums[idx] = album;
      const saveResult = await hymnalApi.saveSettings(settings);
      if (!saveResult.success) return saveResult;
      return { success: true };
    }
    return { success: false, error: '앨범을 찾을 수 없습니다.' };
  },

  deleteAlbum: async (id: string) => {
    const settings = await hymnalApi.getSettings();
    settings.albums = settings.albums.filter((a: any) => a.id !== id);
    const saveResult = await hymnalApi.saveSettings(settings);
    if (!saveResult.success) return saveResult;
    return { success: true };
  },

  updateSong: async (song: any) => {
    const songs = await hymnalApi.getSongs();
    const idx = songs.findIndex((s: any) => s.id === song.id);
    if (idx !== -1) {
      songs[idx] = { ...songs[idx], ...song };
      try {
        await gdriveWebService.uploadJsonFile('music_data.json', songs);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: '곡을 찾을 수 없습니다.' };
  },

  deleteSong: async (songId: string, shouldDeleteOriginal?: boolean) => {
    let songs = await hymnalApi.getSongs();
    songs = songs.filter((s: any) => s.id !== songId);
    try {
      await gdriveWebService.uploadJsonFile('music_data.json', songs);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  getSavedContis: async () => {
    try {
      const data = await gdriveWebService.downloadJsonFile('saved_contis.json');
      return data || [];
    } catch (e) {
      return [];
    }
  },

  saveConti: async (conti: any) => {
    try {
      const contis = await hymnalApi.getSavedContis();
      const idx = contis.findIndex((c: any) => c.id === conti.id);
      if (idx !== -1) {
        contis[idx] = { ...contis[idx], ...conti, updatedAt: new Date().toISOString() };
      } else {
        contis.push({ ...conti, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
      await gdriveWebService.uploadJsonFile('saved_contis.json', contis);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  deleteSavedConti: async (id: string) => {
    try {
      let contis = await hymnalApi.getSavedContis();
      contis = contis.filter((c: any) => c.id !== id);
      await gdriveWebService.uploadJsonFile('saved_contis.json', contis);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  resolveImagePath: (fileId: string) => {
    return `https://drive.google.com/uc?id=${fileId}`;
  },

  resizeWindow: (width: number, height: number) => {
    console.log(`[WebApp] resizeWindow ignored.`);
  },

  openExternal: (url: string) => {
    window.open(url, '_blank');
  },

  writeClipboard: (text: string) => {
    navigator.clipboard.writeText(text).catch(err => console.error(err));
  },

  processImages: async (args: any) => {
    return { processed: 0 };
  },

  onProgress: (callback: any) => {
    return () => {};
  },

  selectFileForConti: () => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        if (e.target.files && e.target.files.length > 0) {
          resolve(e.target.files[0]);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },

  selectFolderForAlbum: (): Promise<File[]> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.webkitdirectory = true;
      (input as any).directory = true;
      input.multiple = true;
      input.onchange = (e: any) => {
        resolve(e.target.files ? Array.from(e.target.files) : []);
      };
      input.click();
    });
  },

  selectMultipleFiles: (): Promise<File[]> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e: any) => {
        resolve(e.target.files ? Array.from(e.target.files) : []);
      };
      input.click();
    });
  },

  batchUploadImagesToGDrive: async (
    files: File[], 
    albumName: string, 
    onProgress: (processed: number, total: number) => void
  ) => {
    const { compressImageToWebP, uploadImageToGDrive } = await import('../utils/imageProcessor');
    const folderId = await gdriveWebService.getOrCreateFolder(`CEUM_Album_${albumName}`);

    const uploadedSongs = [];
    let processedCount = 0;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressedBlob = await compressImageToWebP(file, 0.85);
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        const fileId = await uploadImageToGDrive(compressedBlob, `${fileName}.webp`, folderId);

        const numMatch = fileName.match(/\d+/);
        const number = numMatch ? parseInt(numMatch[0], 10) : uploadedSongs.length + 1;

        uploadedSongs.push({
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: fileName,
          number: number,
          albumId: albumName === '새찬송가' ? 'hymnal' : albumName,
          type: 'image',
          fileId: fileId,
          searchTokens: [fileName]
        });
      } catch (err) {
        console.error(`Failed to upload ${file.name}`, err);
      }
      processedCount++;
      onProgress(processedCount, files.length);
    }
    return uploadedSongs;
  },

  uploadSingleImagesToGDrive: async (
    files: File[], 
    onProgress: (processed: number, total: number) => void
  ) => {
    const { compressImageToWebP, uploadImageToGDrive } = await import('../utils/imageProcessor');
    const uploadedSongs = [];
    let processedCount = 0;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressedBlob = await compressImageToWebP(file, 0.85);
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        const fileId = await uploadImageToGDrive(compressedBlob, `${fileName}.webp`);

        uploadedSongs.push({
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: fileName,
          number: uploadedSongs.length + 1,
          albumId: 'misc',
          type: 'image',
          fileId: fileId,
          searchTokens: [fileName]
        });
      } catch (err) {
        console.error(`Failed to upload ${file.name}`, err);
      }
      processedCount++;
      onProgress(processedCount, files.length);
    }
    return uploadedSongs;
  }
};
