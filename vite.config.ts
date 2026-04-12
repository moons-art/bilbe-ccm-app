import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'sharp',
                'tesseract.js',
                'googleapis',
                'google-auth-library',
                'xlsx',
                'electron',
                'path',
                'fs',
                'os',
                'crypto'
              ]
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
    }),
    renderer(),
  ],
})
