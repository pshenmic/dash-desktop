import { BrowserWindow, dialog } from 'electron'
import { IpcMainInvokeEvent } from 'electron/utility'
import { LogService } from '../../services/LogService'
import { QueryStatus } from '../../types/QueryStatus'

export class SaveLogFileHandler {
  constructor(private readonly logService: LogService) {}

  handle = async (event: IpcMainInvokeEvent, name: string): Promise<QueryStatus> => {
    try {
      this.logService.validateFileName(name)
      const window = BrowserWindow.fromWebContents(event.sender)
      const options = { defaultPath: name, filters: [{ name: 'Log files', extensions: ['log'] }] }
      const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { success: false, errorMessage: null }
      await this.logService.copyFile(name, result.filePath)
      return { success: true, errorMessage: null }
    } catch (error) {
      return { success: false, errorMessage: error instanceof Error ? error.message : String(error) }
    }
  }
}
