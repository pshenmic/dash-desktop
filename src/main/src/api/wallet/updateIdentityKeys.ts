import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { IdentityKeysUpdate } from '../../types/IdentityKeys'

export class UpdateIdentityKeysHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identifier: string,
    update: IdentityKeysUpdate,
    password: string,
  ): Promise<string> => {
    return this.identities.updateIdentityKeys(walletId, identifier, update, password)
  }
}
