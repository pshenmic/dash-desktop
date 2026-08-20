import { IpcMainInvokeEvent } from 'electron/utility'
import { LogService } from '../../services/app/LogService'
import { LogFileInfo } from '../../types/Log'

export class ListLogFiles {
  constructor(private readonly logService: LogService) {}

  handle = async (_event: IpcMainInvokeEvent): Promise<LogFileInfo[]> => this.logService.listFiles()
}
