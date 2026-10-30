import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { Username } from '../../types/Username'

export class RegisterUsernameHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identifier: string,
    label: string,
    password: string,
  ): Promise<Username> => {
    return this.identities.registerUsername(walletId, identifier, label, password)
  }
}
