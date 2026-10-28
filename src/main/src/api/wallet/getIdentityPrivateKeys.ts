import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { IdentityPrivateKey } from '../../types/IdentityKeys'

export class GetIdentityPrivateKeysHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, identifier: string, password: string): Promise<IdentityPrivateKey[]> => {
    return this.identities.getIdentityPrivateKeys(walletId, identifier, password)
  }
}
