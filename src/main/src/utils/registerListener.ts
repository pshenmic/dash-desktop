import {ipcMain, IpcMainEvent} from 'electron'
import {Logger} from './logger'

const log = new Logger('ipc')

// The send/on counterpart to registerHandler. Nothing is awaiting the listener
// on the renderer side, so a rethrow here would surface as an unhandled
// rejection rather than reaching a caller.
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
