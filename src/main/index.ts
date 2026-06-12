import { app, shell, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo.png?asset'
import { WalletBackend } from './src/WalletBackend'
import packageJSON from '../../package.json'

const backend = new WalletBackend()

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 576,
    show: false,
    autoHideMenuBar: true,
    icon: icon,
    title: `Dash Desktop Wallet (${packageJSON.version})`,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'right' })
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Dark mode
ipcMain.handle('dark-mode:get', () => {
  return nativeTheme.shouldUseDarkColors
})

ipcMain.handle('dark-mode:system', () => {
  nativeTheme.themeSource = 'system'
})

nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors)
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pshenmic.dashplatformwallet')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  backend.start()
    .then(createWindow)
    .catch((err) => {
      console.error(err)
      dialog.showErrorBox('Startup failed', String(err))
    })

  app.on('activate', () => {
    if (mainWindow === null) {
      backend.start()
        .then(createWindow)
        .catch((err) => {
          console.error(err)
          dialog.showErrorBox('Startup failed', String(err))
        })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Stop the p2p utility process gracefully before quitting so chain.db's
// LevelDB lock is released. Without this a killed worker leaves a stale lock
// that blocks the next launch's open (LEVEL_DATABASE_NOT_OPEN).
let backendStopped = false
app.on('before-quit', (event) => {
  if (backendStopped) return
  event.preventDefault()
  backendStopped = true
  backend.shutdown()
    .catch((err) => console.error('[shutdown] backend shutdown failed:', err))
    .finally(() => app.quit())
})
