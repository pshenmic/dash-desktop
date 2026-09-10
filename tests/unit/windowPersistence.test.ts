import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindowConstructorOptions } from 'electron'
import type { WindowState } from '../../src/main/src/types/WindowState'

const storage = vi.hoisted(() => ({ json: '' }))

vi.mock('fs', () => ({
  readFileSync: () => storage.json,
  writeFileSync: (_path: string, json: string) => { storage.json = json },
}))
vi.mock('../../src/main/src/utils/dataPath', () => ({
  dataPath: (filename: string) => filename,
}))
vi.mock('../../src/main/src/logTransport', () => ({ initLogTransport: vi.fn() }))
vi.mock('../../src/main/src/WalletBackend', () => ({
  WalletBackend: class {
    start = async (): Promise<void> => {}
    shutdown = async (): Promise<void> => {}
  },
}))
vi.mock('../../../resources/logo.png?asset', () => ({ default: '' }))
vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() },
  is: { dev: false },
}))

class TestWindow extends EventEmitter {
  static latest: TestWindow
  bounds: Electron.Rectangle
  maximized = false
  minimized = false
  webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() })

  constructor(readonly options: BrowserWindowConstructorOptions) {
    super()
    TestWindow.latest = this
    this.bounds = {
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width!,
      height: options.height!,
    }
  }

  getNormalBounds = (): Electron.Rectangle => ({ ...this.bounds })
  isMaximized = (): boolean => this.maximized
  isMinimized = (): boolean => this.minimized
  show = vi.fn()
  loadFile = vi.fn()
  maximize = (): void => {
    this.maximized = true
    this.emit('maximize')
  }
}

const launch = async (): Promise<TestWindow> => {
  vi.resetModules()
  vi.doMock('electron', () => ({
    app: Object.assign(new EventEmitter(), { whenReady: async () => {}, quit: vi.fn() }),
    BrowserWindow: TestWindow,
    ipcMain: { handle: vi.fn() },
    nativeTheme: new EventEmitter(),
    dialog: { showErrorBox: vi.fn() },
    shell: {},
    Menu: {},
    screen: {
      getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1040 } }),
      getAllDisplays: () => [
        { workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
        { workArea: { x: -1920, y: 0, width: 1920, height: 1040 } },
      ],
    },
  }))
  await import('../../src/main/index')
  await Promise.resolve()
  TestWindow.latest.emit('ready-to-show')
  return TestWindow.latest
}

const readState = (): WindowState => JSON.parse(storage.json)

describe('window persistence', () => {
  beforeEach(() => { storage.json = '' })

  it('restores the moved position on a second monitor without needing a close event', async () => {
    const window = await launch()
    window.bounds = { x: -1700, y: 140, width: 1300, height: 780 }
    window.emit('moved')

    const reopened = await launch()
    expect(reopened.bounds).toEqual(window.bounds)
  })

  it('restores the last resized dimensions', async () => {
    const window = await launch()
    window.bounds = { x: 210, y: 95, width: 1450, height: 820 }
    window.emit('resized')

    expect((await launch()).bounds).toEqual(window.bounds)
  })

  it('preserves maximized state and normal bounds when closed while minimized', async () => {
    const window = await launch()
    window.bounds = { x: 210, y: 95, width: 1450, height: 820 }
    window.maximize()
    window.minimized = true
    window.maximized = false
    window.emit('close')

    const reopened = await launch()
    expect(reopened.maximized).toBe(true)
    expect(reopened.bounds).toEqual(window.bounds)
  })

  it('remembers leaving the maximized state', async () => {
    const window = await launch()
    window.maximize()
    window.maximized = false
    window.emit('unmaximize')

    expect((await launch()).maximized).toBe(false)
  })

  it.each(['close', 'session-end'])('saves the final position on %s', async (event) => {
    const window = await launch()
    window.bounds = { x: 320, y: 120, width: 1250, height: 750 }
    window.emit(event)

    expect(readState()).toEqual({ ...window.bounds, maximized: false })
  })
})
