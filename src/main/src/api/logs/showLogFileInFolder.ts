import { shell } from 'electron'
import { IpcMainInvokeEvent } from 'electron/utility'
import { LogService } from '../../services/app/LogService'

export class ShowLogFileInFolderHandler {
  constructor(private readonly logService: LogService) {}

  handle = async (_event: IpcMainInvokeEvent, name: string): Promise<void> => {
    const filePath = await this.logService.getFilePath(name)
    shell.showItemInFolder(filePath)
  }
}
