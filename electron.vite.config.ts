import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Upstream bug in @dashevo/x11-hash-js: groestl.js uses `this.hi` in a plain
// function (B64) where `this` is undefined under ESM/strict mode, crashing
// every x11 hash. CJS callers silently coerce to globalThis and produce wrong
// hashes — we want correct hashes, so patch the source at bundle time.
const x11GroestlFixPlugin = (): Plugin => ({
  name: 'x11-groestl-this-fix',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('@dashevo/x11-hash-js/lib/groestl')) return null
    if (!code.includes('toMoveDown = this.hi')) return null
    return {
      code: code.replace(
        /toMoveDown\s*=\s*this\.hi\s*<<\s*bitsOff32\s*>>>\s*bitsOff32/,
        'toMoveDown = x.hi << bitsOff32 >>> bitsOff32',
      ),
      map: null,
    }
  },
})

export default defineConfig({
  main: {
    plugins: [x11GroestlFixPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          p2p: resolve('src/main/p2p/index.ts'),
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
    plugins: [react()]
  }
})