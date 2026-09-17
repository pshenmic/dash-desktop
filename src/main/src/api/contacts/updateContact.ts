import { IpcMainInvokeEvent } from 'electron/utility'
import { ContactService } from '../../services/app/ContactService'
import { ContactKind } from '../../types/Contact'

export class UpdateContactHandler {
  private contactService: ContactService

  constructor(contactService: ContactService) {
    this.contactService = contactService
  }

  handle = async (_event: IpcMainInvokeEvent, id: number, label: string, address: string, kind: ContactKind): Promise<void> => {
    return this.contactService.updateContact(id, label, address, kind)
  }
}
