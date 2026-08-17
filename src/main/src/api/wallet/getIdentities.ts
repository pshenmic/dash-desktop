import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { IdentityInfo } from '../../types/Identity'

export class GetIdentitiesHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<IdentityInfo[]> => {
    return this.identities.getIdentities(walletId)
  }
}
