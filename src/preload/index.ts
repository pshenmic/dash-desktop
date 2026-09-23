import { contextBridge, ipcRenderer  } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {apiDefinitions} from './definitions'

// The preload runs in a renderer, but this bundle typechecks with the main
// process, which carries no DOM lib.
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

// contextBridge clones what crosses it and a MessagePort has no representation
// there, so the renderer cannot reach ipcRenderer.postMessage with one. It sends
// the port over window.postMessage, which transfers natively, and this forwards
// the real object. The tag is spelled again in renderer constants/notifications.
window.addEventListener('message', event => {
  if (event.source !== window || event.data !== 'createMessagePort') return
  const [port] = event.ports
  if (port) ipcRenderer.postMessage('createMessagePort', null, [port])
})
