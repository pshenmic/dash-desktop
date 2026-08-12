import { IpcMainInvokeEvent } from 'electron/utility'
import { LogService } from '../../services/LogService'
import { LogFileInfo } from '../../types/Log'

export class GetLogFilesHandler {
  constructor(private readonly logService: LogService) {}

  handle = async (_event: IpcMainInvokeEvent): Promise<LogFileInfo[]> => this.logService.listFiles()
}
