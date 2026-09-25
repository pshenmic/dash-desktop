import { contextBridge, ipcRenderer  } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {apiDefinitions} from './definitions'

// This bundle typechecks with the main process, which has no DOM lib.
declare const window: {
  addEventListener(
    type: 'message',
    listener: (event: {
      source: unknown
      data: unknown
      ports: InstanceType<typeof MessagePort>[]
    }) => void,
  ): void
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', apiDefinitions(ipcRenderer))
    contextBridge.exposeInMainWorld('darkMode', {
      get: () => ipcRenderer.invoke('dark-mode:get'),
      system: () => ipcRenderer.invoke('dark-mode:system'),
      onChange: (callback: (isDark: boolean) => void) => {
        ipcRenderer.on('theme-changed', (_event, isDark) => callback(isDark))
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

// A MessagePort cannot cross contextBridge, so the renderer transfers it over
// window.postMessage and this forwards the real object.
window.addEventListener('message', event => {
  if (event.source !== window || event.data !== 'createMessagePort') return
  const [port] = event.ports
  if (port) ipcRenderer.postMessage('createMessagePort', null, [port])
})
