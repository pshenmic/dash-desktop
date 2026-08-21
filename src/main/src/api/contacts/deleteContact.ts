import { IpcMainInvokeEvent } from 'electron/utility'
import { ContactService } from '../../services/app/ContactService'

export class DeleteContactHandler {
  private contactService: ContactService

  constructor(contactService: ContactService) {
    this.contactService = contactService
  }

  handle = async (_event: IpcMainInvokeEvent, id: number): Promise<void> => {
    return this.contactService.deleteContact(id)
  }
}
