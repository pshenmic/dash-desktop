import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { Alias } from '../../types/Alias'

export class RegisterAliasHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identifier: string,
    label: string,
    password: string,
  ): Promise<Alias> => {
    return this.identities.registerAlias(walletId, identifier, label, password)
  }
}
