import { IpcMainInvokeEvent } from 'electron/utility'
import { ContactService } from '../../services/app/ContactService'
import { Network } from '../../types/Network'
import { ContactKind } from '../../types/Contact'

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
    kind: ContactKind = 'core',
  ): Promise<void> => {
    return this.contactService.addContact(label, address, network, kind)
  }
}
