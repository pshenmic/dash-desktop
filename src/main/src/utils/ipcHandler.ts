import {ipcMain, IpcMainInvokeEvent} from 'electron'
import {Logger} from './logger'

const log = new Logger('ipc')

export function registerHandler<A extends unknown[]>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: A) => unknown,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...(args as A))
    } catch (error) {
      log.error(`${channel}:`, error)
      throw error
    }
  })
}
