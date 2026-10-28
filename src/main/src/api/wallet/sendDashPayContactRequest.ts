import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { DashPayContact } from '../../types/DashPay'

export class SendDashPayContactRequestHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identifier: string,
    recipient: string,
    password: string,
  ): Promise<DashPayContact[]> => {
    return this.identities.sendDashPayContactRequest(walletId, identifier, recipient, password)
  }
}
