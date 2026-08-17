import { IpcMainInvokeEvent } from 'electron/utility'
import { ContactService } from '../../services/app/ContactService'
import { QueryStatus } from '../../types/QueryStatus'

export class DeleteContactHandler {
  private contactService: ContactService

  constructor(contactService: ContactService) {
    this.contactService = contactService
  }

  handle = async (_event: IpcMainInvokeEvent, id: number): Promise<QueryStatus> => {
    return this.contactService.deleteContact(id)
  }
}
