// src/api/gdriveWebService.ts

const GAPI_CLIENT_ID = '786503545807-v0340nhgjnd3rg3i3k03i9r7jrpdnr0h.apps.googleusercontent.com';

// 구글 API 초기화 상태
let isGapiLoaded = false;
let isGsiLoaded = false;
let tokenClient: any = null;

// OAuth 토큰 캐시
let accessToken: string | null = null;

export const initGoogleApi = (onInit: () => void) => {
  // 1. Google API (gapi) 로드
  const gapiScript = document.createElement('script');
  gapiScript.src = 'https://apis.google.com/js/api.js';
  gapiScript.onload = () => {
    window.gapi.load('client', async () => {
      await window.gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });
      isGapiLoaded = true;
      if (isGsiLoaded) onInit();
    });
  };
  document.body.appendChild(gapiScript);

  // 2. Google Identity Services (GSI) 로드
  const gsiScript = document.createElement('script');
  gsiScript.src = 'https://accounts.google.com/gsi/client';
  gsiScript.onload = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GAPI_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
      callback: (response: any) => {
        if (response.error !== undefined) {
          throw (response);
        }
        accessToken = response.access_token;
        console.log('Successfully authenticated with Google Drive');
      },
    });
    isGsiLoaded = true;
    if (isGapiLoaded) onInit();
  };
  document.body.appendChild(gsiScript);
};

export const gdriveWebService = {
  // 토큰 반환
  getAccessToken: () => accessToken,

  // 로그인 요청
  login: () => {
    return new Promise((resolve) => {
      if (!tokenClient) return resolve(false);
      
      // 토큰 갱신 로직 오버라이드
      const originalCallback = tokenClient.callback;
      tokenClient.callback = (response: any) => {
        originalCallback(response);
        resolve(true);
      };
      
      if (accessToken === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
      } else {
        tokenClient.requestAccessToken({prompt: ''});
      }
    });
  },

  // 파일 다운로드 (JSON)
  downloadJsonFile: async (fileName: string) => {
    if (!accessToken) throw new Error('Not authenticated');
    
    // 1. 파일 검색
    const res = await window.gapi.client.drive.files.list({
      q: `name='${fileName}' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });
    const files = res.result.files;
    
    if (!files || files.length === 0) {
      return null; // 파일 없음
    }
    
    // 2. 파일 내용 가져오기
    const fileId = files[0].id;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });
    
    if (!response.ok) throw new Error('Failed to download file');
    return await response.json();
  },

  // JSON 업로드 (multipart/related)
  uploadJsonFile: async (fileName: string, data: any) => {
    if (!accessToken) throw new Error('Not authenticated');

    const res = await window.gapi.client.drive.files.list({
      q: `name='${fileName}' and trashed=false`,
      spaces: 'drive',
    });
    const files = res.result.files;

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (files && files.length > 0) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=multipart`;
      method = 'PATCH';
    }

    const metadata = { name: fileName, mimeType: 'application/json' };
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(data) +
      close_delim;

    const uploadRes = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('Upload failed:', errText);
      throw new Error(`Upload failed: ${errText}`);
    }
    return uploadRes.json();
  },

  // -----------------------------------------
  // Folder & General Sync Methods
  // -----------------------------------------
  
  // 이름으로 폴더를 찾고, 없으면 생성 후 ID 반환
  getOrCreateFolder: async (folderName: string): Promise<string> => {
    if (!accessToken) throw new Error('Not authenticated');
    
    // 1. 폴더 존재 여부 확인
    const res = await window.gapi.client.drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });
    
    const files = res.result.files;
    if (files && files.length > 0) {
      return files[0].id;
    }
    
    // 2. 없으면 새로 생성
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });
    
    if (!createRes.ok) throw new Error(`Failed to create folder ${folderName}`);
    const createdFolder = await createRes.json();
    return createdFolder.id;
  },

  // -----------------------------------------
  // Bible Sync Methods (Visible Folder)
  // -----------------------------------------
  listBibleFiles: async () => {
    if (!accessToken) throw new Error('Not authenticated');
    const folderId = await gdriveWebService.getOrCreateFolder('CEUM_Bible_Data');
    
    const res = await window.gapi.client.drive.files.list({
      q: `'${folderId}' in parents and mimeType='text/plain' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });
    return res.result.files || [];
  },

  downloadBibleFile: async (fileId: string) => {
    if (!accessToken) throw new Error('Not authenticated');
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error('Failed to download bible');
    return await response.text();
  },

  uploadBibleFile: async (fileName: string, textData: string) => {
    if (!accessToken) throw new Error('Not authenticated');
    const folderId = await gdriveWebService.getOrCreateFolder('CEUM_Bible_Data');

    const res = await window.gapi.client.drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      spaces: 'drive',
    });
    const files = res.result.files;

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';
    const metadata: any = { name: fileName, mimeType: 'text/plain' };

    if (files && files.length > 0) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=multipart`;
      method = 'PATCH';
    } else {
      metadata.parents = [folderId];
    }

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
      textData +
      close_delim;

    const uploadRes = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!uploadRes.ok) throw new Error('Bible upload failed');
    return uploadRes.json();
  },

  // 이미지 파일 (미디어) Blob 다운로드
  downloadImageBlob: async (fileId: string): Promise<string | null> => {
    if (!accessToken) return null;
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Failed to download image blob', e);
      return null;
    }
  },

  renameFolder: async (oldName: string, newName: string) => {
    if (!accessToken) throw new Error('Not authenticated');
    try {
      const res = await window.gapi.client.drive.files.list({
        q: `name='${oldName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive',
      });
      const folders = res.result.files;

      if (folders && folders.length > 0) {
        const folderId = folders[0].id;
        await window.gapi.client.drive.files.update({
          fileId: folderId,
          resource: { name: newName }
        });
        return true;
      }
    } catch (err) {
      console.error('Rename folder failed', err);
    }
    return false;
  }
};
