import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { IdentityKeyRequest } from '../../types/IdentityKeys'

export class CreateIdentityKeysHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identifier: string,
    keys: IdentityKeyRequest[],
    password: string,
  ): Promise<string> => {
    return this.identities.createIdentityKeys(walletId, identifier, keys, password)
  }
}
