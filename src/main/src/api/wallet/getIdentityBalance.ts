import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'

export class GetIdentityBalance {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, identityId: string): Promise<bigint> => {
    return this.identities.getIdentityBalance(identityId)
  }
}
