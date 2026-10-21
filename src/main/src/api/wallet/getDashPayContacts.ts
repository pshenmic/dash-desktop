import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { DashPayContact } from '../../types/Contact'

export class GetDashPayContactsHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<DashPayContact[]> => {
    return this.identities.getContacts(walletId)
  }
}
