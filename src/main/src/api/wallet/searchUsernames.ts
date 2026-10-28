import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { UsernameSearchResult } from '../../types/Username'

export class SearchUsernamesHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, prefix: string): Promise<UsernameSearchResult[]> => {
    return this.identities.searchUsernames(walletId, prefix)
  }
}
