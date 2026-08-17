import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // Keep pshenmic-dpp external so the wallet's own imports resolve to the
        // same runtime instance (native.js → threaded WASM on Windows) that the
        // externalized dash-platform-sdk uses. Bundling it here forked a second
        // WASM/NAPI instance, so objects (e.g. CoreScriptWASM) built wallet-side
        // couldn't be recovered by the SDK's builders.
        //
        // crypto-toothpick for a related reason: it resolves its N-API addon by
        // platform at runtime, which rollup cannot follow.
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