import { app, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null = null

import { registerHymnalIPC } from './hymnalIPC'

// 찬송가 데이터 폴더 초기화
function initHymnalDir() {
  const hymnalDir = path.join(app.getPath('userData'), 'hymnal')
  console.log('Hymnal Data Path:', hymnalDir)
  const imagesDir = path.join(hymnalDir, 'hymnal_images')
  const dbPath = path.join(hymnalDir, 'music_data.json')

  if (!fs.existsSync(hymnalDir)) fs.mkdirSync(hymnalDir, { recursive: true })
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, '[]', 'utf8')
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC || path.join(__dirname, '../public'), 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Hymnal IPC 등록
  registerHymnalIPC(win)

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// 프로토콜 우선 등록 (bypassCSP 설정 포함)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'hymnal-resource',
    privileges: { bypassCSP: true, stream: true, standard: true, supportFetchAPI: true }
  }
])

app.whenReady().then(() => {
  // 폴더 초기화 실행
  initHymnalDir()

  // 프로토콜 핸들러 등록
  protocol.handle('hymnal-resource', (request) => {
    try {
      // request.url은 'hymnal-resource://파일명' 형식입니다.
      // URL 객체를 생성하면 hostname이 강제로 소문자로 변환되므로, 
      // 대소문자를 구분하는 파일 시스템이나 파일 매칭을 위해 직접 파싱합니다.
      const prefix = 'hymnal-resource://';
      let fileName = '';
      
      if (request.url.startsWith(prefix)) {
        fileName = request.url.slice(prefix.length);
      } else {
        // 혹시 prefix 포맷이 다를 경우를 위한 안전 장치
        const url = new URL(request.url);
        fileName = url.hostname + url.pathname;
      }
      
      // URL 인코딩된 파일명(공백 등)을 원래대로 복원 (대소문자 유지)
      fileName = decodeURIComponent(fileName).replace(/^\//, '').replace(/\/$/, '');
      
      // 이미 'hymnal_images/'가 포함되어 있다면 중복되지 않도록 처리
      const relativePath = fileName.startsWith('hymnal_images/') 
        ? fileName.replace('hymnal_images/', '') 
        : fileName;
      
      const filePath = path.join(app.getPath('userData'), 'hymnal', 'hymnal_images', relativePath)
      
      if (!fs.existsSync(filePath)) {
        console.error('[HymnalProtocol] File not found:', filePath)
        return new Response('File not found', { status: 404 })
      }

      console.log('[HymnalProtocol] Serving:', fileName)
      const data = fs.readFileSync(filePath)
      return new Response(data)
    } catch (err) {
      console.error('[HymnalProtocol] Error:', err)
      return new Response('Protocol Error', { status: 500 })
    }
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

