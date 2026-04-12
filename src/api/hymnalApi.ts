const isElectron = !!(window as any).ipcRenderer;
const SERVER_BASE = 'http://localhost:8080';
const API_BASE = `${SERVER_BASE}/api`;

// 헬퍼: HTTP 요청용
async function fetchApi(path: string, method = 'GET', body?: any) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  return response.json();
}

export const hymnalApi = {
  // Album Management
  getSettings: () => 
    isElectron ? (window as any).ipcRenderer.hymnal.getSettings() : fetchApi('/get-settings'),
  saveSettings: (settings: any) => 
    isElectron ? (window as any).ipcRenderer.hymnal.saveSettings(settings) : fetchApi('/save-settings', 'POST', settings),
  addAlbum: (album: any) => 
    isElectron ? (window as any).ipcRenderer.hymnal.addAlbum(album) : fetchApi('/add-album', 'POST', album),
  updateAlbum: (album: any) => 
    isElectron ? (window as any).ipcRenderer.hymnal.updateAlbum(album) : fetchApi('/update-album', 'POST', album),
  deleteAlbum: (albumId: string) => 
    isElectron ? (window as any).ipcRenderer.hymnal.deleteAlbum(albumId) : fetchApi('/delete-album', 'POST', { id: albumId }),

  getSongs: () => 
    isElectron ? (window as any).ipcRenderer.hymnal.getSongs() : fetchApi('/get-songs'),
  selectFolder: async () => {
    if (isElectron) return (window as any).ipcRenderer.hymnal.selectFolder();
    const data = await fetchApi('/select-folder', 'POST');
    return data.path;
  },
  processImages: (args: any) => 
    isElectron ? (window as any).ipcRenderer.hymnal.processImages(args) : fetchApi('/process-images', 'POST', args),
  
  onProgress: (callback: (data: { processed: number; total: number }) => void) => {
    if (isElectron) {
      return (window as any).ipcRenderer.hymnal.onProgress(callback);
    } else {
      let lastProcessed = -1;
      const interval = setInterval(async () => {
        try {
          const progress = await fetchApi('/get-progress');
          if (progress && progress.processed !== lastProcessed) {
            callback(progress);
            lastProcessed = progress.processed;
          }
        } catch (err) {
          console.error('Progress polling error:', err);
        }
      }, 500); // 0.5초마다 확인

      return () => clearInterval(interval);
    }
  },

  syncGDrive: (albumId?: string) => 
    isElectron ? (window as any).ipcRenderer.hymnal.syncGDrive(albumId) : fetchApi('/sync-gdrive', 'POST', { albumId }),
  getAuthUrl: () => 
    isElectron ? (window as any).ipcRenderer.hymnal.getAuthUrl() : fetchApi('/auth-url'),
  waitForAuthCode: () => 
    isElectron ? (window as any).ipcRenderer.hymnal.waitForAuthCode() : fetchApi('/wait-auth'),
  confirmAuth: (code: string) => 
    isElectron ? (window as any).ipcRenderer.hymnal.confirmAuth(code) : fetchApi('/confirm-auth', 'POST', { code }),
  
  updateSong: (song: any) => 
    isElectron ? (window as any).ipcRenderer.hymnal.updateSong(song) : fetchApi('/update-song', 'POST', song),
  deleteSong: (songId: string, shouldDeleteOriginal?: boolean) => 
    isElectron ? (window as any).ipcRenderer.hymnal.deleteSong({ songId, shouldDeleteOriginal }) : fetchApi('/delete-song', 'POST', { songId, shouldDeleteOriginal }),
  
  exportCSV: (args?: any) => 
    isElectron ? (window as any).ipcRenderer.hymnal.exportCSV(args) : fetchApi('/export-csv', 'POST', args),
  importCSV: () => 
    isElectron ? (window as any).ipcRenderer.hymnal.importCSV() : fetchApi('/import-csv', 'POST'),
  
  openExternal: (url: string) => 
    isElectron ? (window as any).ipcRenderer.hymnal.openExternal(url) : fetchApi('/open-external', 'POST', { url }),
    
  // Google Slides
  generateSlides: (args: any) => 
    isElectron ? (window as any).ipcRenderer.hymnal.generateSlides(args) : fetchApi('/generate-slides', 'POST', args),
  onSlidesProgress: (callback: (data: { msg: string; percent: number }) => void) => {
    if (isElectron) {
      return (window as any).ipcRenderer.hymnal.onSlidesProgress(callback);
    }
    return () => {}; // Web 환경은 차후 지원
  },
    
  generatePDF: (args: any) => 
    isElectron ? (window as any).ipcRenderer.hymnal.generatePDF(args) : fetchApi('/generate-pdf', 'POST', args),
  onPDFProgress: (callback: (data: { msg: string; percent: number }) => void) => {
    if (isElectron) {
      return (window as any).ipcRenderer.hymnal.onPDFProgress(callback);
    }
    return () => {};
  },
    
  // Conti Storage
  getSavedContis: () => 
    isElectron ? (window as any).ipcRenderer.hymnal.getSavedContis() : fetchApi('/get-saved-contis'),
  saveConti: (conti: any) => 
    isElectron ? (window as any).ipcRenderer.hymnal.saveConti(conti) : fetchApi('/save-conti', 'POST', conti),
  deleteSavedConti: (id: string) => 
    isElectron ? (window as any).ipcRenderer.hymnal.deleteSavedConti(id) : fetchApi('/delete-saved-conti', 'POST', { id }),

  resizeWindow: (width: number, height: number) =>
    isElectron ? (window as any).ipcRenderer.hymnal.resizeWindow(width, height) : fetchApi('/resize-window', 'POST', { width, height }),

  writeClipboard: (text: string) => {
    if (isElectron) {
      (window as any).ipcRenderer.hymnal.writeClipboard(text);
    } else {
      navigator.clipboard.writeText(text).catch(err => console.error('Clipboard error:', err));
    }
  },

  // 유틸리티: 이미지 경로 변환
  resolveImagePath: (filePath: string) => {
    // hymnal-resource 프로토콜 대신, 항상 통합된 로컬 서버(8080) 리소스를 활용하도록 수정
    return `${SERVER_BASE}/resource/${filePath}`;
  }
};
