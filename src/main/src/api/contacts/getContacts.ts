import { IpcMainInvokeEvent } from 'electron/utility'
import { ContactService } from '../../services/ContactService'
import { Contact } from '../../types/Contact'
import { Network } from '../../types/Network'

export class GetContactsHandler {
  private contactService: ContactService

  constructor(contactService: ContactService) {
    this.contactService = contactService
  }

  handle = async (_event: IpcMainInvokeEvent, network?: Network): Promise<Contact[]> => {
    return this.contactService.getContacts(network)
  }
}
