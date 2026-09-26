import {ipcMain, IpcMainEvent} from 'electron'
import {Logger} from './logger'

const log = new Logger('ipc')

// Unlike registerHandler there is no invoke to reject, so a rethrow would only
// surface as an unhandled rejection.
export function registerListener<A extends unknown[]>(
  channel: string,
  listener: (event: IpcMainEvent, ...args: A) => unknown,
): void {
  ipcMain.on(channel, async (event, ...args) => {
    try {
      await listener(event, ...(args as A))
    } catch (error) {
      log.error(`${channel}:`, error)
    }
  })
}
