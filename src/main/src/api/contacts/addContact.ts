import { IpcMainInvokeEvent } from 'electron/utility'
import { ContactService } from '../../services/ContactService'
import { QueryStatus } from '../../types/QueryStatus'
import { Network } from '../../types/Network'

export class AddContactHandler {
  private contactService: ContactService

  constructor(contactService: ContactService) {
    this.contactService = contactService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    label: string,
    address: string,
    network: Network,
  ): Promise<QueryStatus> => {
    return this.contactService.addContact(label, address, network)
  }
}
