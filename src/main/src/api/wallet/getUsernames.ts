import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { Username } from '../../types/Username'

export class GetUsernamesHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<Username[]> => {
    return this.identities.getUsernames(walletId)
  }
}
