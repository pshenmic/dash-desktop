import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['pshenmic-dpp', 'crypto-toothpick'],
        input: {
          index: resolve('src/main/index.ts'),
          p2p: resolve('src/main/p2p/index.ts'),
          platform: resolve('src/main/platform/index.ts'),
        },
      },
    },
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    server: {
      host: '127.0.0.1'
    },
    plugins: [react()]
  }
})
