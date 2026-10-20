import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'

export class ResolveAliasHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, label: string): Promise<string | null> => {
    return this.identities.resolveAlias(walletId, label)
  }
}
