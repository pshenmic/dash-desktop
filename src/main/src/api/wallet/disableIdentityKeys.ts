import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'

export class DisableIdentityKeysHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identifier: string,
    keyIds: number[],
    password: string,
  ): Promise<string> => {
    return this.identities.disableIdentityKeys(walletId, identifier, keyIds, password)
  }
}
