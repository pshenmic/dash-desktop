import {IpcMainEvent} from 'electron'
import {NotifyService} from '../services/app/NotifyService'

export class CreateMessagePortHandler {
  private notifyService: NotifyService

  constructor(notifyService: NotifyService) {
    this.notifyService = notifyService
  }

  handle = async (event: IpcMainEvent): Promise<void> => {
    const [port] = event.ports
    if (port) this.notifyService.connect(port)
  }
}
