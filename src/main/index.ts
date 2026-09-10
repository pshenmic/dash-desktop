import { app, shell, BrowserWindow, nativeTheme, dialog, Menu, screen } from 'electron'
import { writeFile } from 'fs/promises'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo.png?asset'
import { WalletBackend } from './src/WalletBackend'
import { initLogTransport } from './src/logTransport'
import { WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH, WindowStateFilename } from './src/constants/app'
import { dataPath } from './src/utils/dataPath'
import { computeDefaultWindowSize, restoreWindowState } from './src/utils/windowBounds'
import { WindowState } from './src/types/WindowState'
import packageJSON from '../../package.json'
import {registerHandler} from './src/utils/ipcHandler'
import {Logger} from './src/utils/logger'

const log = new Logger('startup')
const shutdown = new Logger('shutdown')
const windowState = new Logger('window-state')
const crash = new Logger('crash')

initLogTransport()

process.on('uncaughtException', err => {
  crash.error('uncaughtException:', err)
})
process.on('unhandledRejection', reason => {
  crash.error('unhandledRejection:', reason)
})

const backend = new WalletBackend()

let mainWindow: BrowserWindow | null = null;

const windowStatePath = dataPath(WindowStateFilename)

const readWindowState = (): WindowState | null => {
  try {
    const raw = JSON.parse(readFileSync(windowStatePath, 'utf-8'))
    return restoreWindowState(raw, screen.getAllDisplays().map((display) => display.workArea))
  } catch {
    return null
  }
}

const saveWindowState = (window: BrowserWindow): void => {
  try {
    const maximized = window.isMinimized()
      ? readWindowState()?.maximized ?? false
      : window.isMaximized()
    const state: WindowState = { ...window.getNormalBounds(), maximized }
    writeFileSync(windowStatePath, JSON.stringify(state))
  } catch (err) {
    windowState.error('save failed:', err)
  }
}

const createWindow = (): void => {
  const saved = readWindowState()
  const defaultSize = computeDefaultWindowSize(screen.getPrimaryDisplay().workAreaSize)
  mainWindow = new BrowserWindow({
    width: saved?.width ?? defaultSize.width,
    height: saved?.height ?? defaultSize.height,
    ...(saved ? { x: saved.x, y: saved.y } : {}),
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
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
    if (saved?.maximized) {
      mainWindow?.maximize()
    }
    mainWindow?.show()
    if (mainWindow) {
      saveWindowState(mainWindow)
    }
  })

  const persistWindowState = (): void => {
    if (mainWindow) {
      saveWindowState(mainWindow)
    }
  }
  mainWindow.on('moved', persistWindowState)
  mainWindow.on('resized', persistWindowState)
  mainWindow.on('maximize', persistWindowState)
  mainWindow.on('unmaximize', persistWindowState)
  mainWindow.on('close', persistWindowState)
  mainWindow.on('session-end', persistWindowState)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (params.isEditable) {
      Menu.buildFromTemplate([
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', enabled: params.editFlags.canSelectAll }
      ]).popup()
    } else if (params.selectionText.trim().length > 0) {
      Menu.buildFromTemplate([
        { role: 'copy', enabled: params.editFlags.canCopy }
      ]).popup()
    }
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
registerHandler('dark-mode:get', () => {
  return nativeTheme.shouldUseDarkColors
})

registerHandler('dark-mode:system', () => {
  nativeTheme.themeSource = 'system'
})

nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors)
  }
})

// false means the user dismissed the save dialog, which is not a failure — a
// failed write throws instead.
registerHandler('saveTextFile', async (_event, defaultFileName: string, content: string): Promise<boolean> => {
  const options = {
    defaultPath: defaultFileName,
    filters: [
      { name: 'CSV', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  }
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options)

  if (result.canceled || !result.filePath) {
    return false
  }

  await writeFile(result.filePath, content, 'utf-8')
  return true
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pshenmic.dashplatformwallet')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  backend.start()
    .then(createWindow)
    .catch((err) => {
      log.error(err)
      dialog.showErrorBox('Startup failed', String(err))
    })

  app.on('activate', () => {
    if (mainWindow === null) {
      backend.start()
        .then(createWindow)
        .catch((err) => {
          log.error(err)
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
    .catch((err) => shutdown.error('backend shutdown failed:', err))
    .finally(() => app.quit())
})
