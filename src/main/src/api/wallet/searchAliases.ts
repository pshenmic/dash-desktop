import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { AliasSearchResult } from '../../types/Alias'

export class SearchAliasesHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, prefix: string): Promise<AliasSearchResult[]> => {
    return this.identities.searchAliases(walletId, prefix)
  }
}
