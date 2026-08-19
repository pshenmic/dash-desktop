import { shell } from 'electron'
import { IpcMainInvokeEvent } from 'electron/utility'
import { LogService } from '../../services/LogService'
import { QueryStatus } from '../../types/QueryStatus'

export class ShowLogFileInFolderHandler {
  constructor(private readonly logService: LogService) {}

  handle = async (_event: IpcMainInvokeEvent, name: string): Promise<QueryStatus> => {
    try {
      const filePath = await this.logService.getFilePath(name)
      shell.showItemInFolder(filePath)
      return { success: true, errorMessage: null }
    } catch (error) {
      return { success: false, errorMessage: error instanceof Error ? error.message : String(error) }
    }
  }
}
