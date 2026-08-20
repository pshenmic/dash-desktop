import { IpcMainInvokeEvent } from 'electron/utility'
import { LogService } from '../../services/app/LogService'
import { LogFileContent } from '../../types/Log'

export class GetLogFileHandler {
  constructor(private readonly logService: LogService) {}

  handle = async (_event: IpcMainInvokeEvent, name: string): Promise<LogFileContent> => this.logService.readFile(name)
}
