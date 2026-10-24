import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { Alias } from '../../types/Alias'

export class GetAliasesHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<Alias[]> => {
    return this.identities.getAliases(walletId)
  }
}
