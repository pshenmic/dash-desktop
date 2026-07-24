import {IpcMainInvokeEvent} from 'electron/utility'
import {PlatformAddressService} from '../../services/PlatformAddressService'
import {IdentityImportResult} from '../../types/IdentityImportResult'

export class ImportIdentityHandler {
  constructor(private readonly platformAddressService: PlatformAddressService) {}

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identityIdentifier: string,
    privateKeys: string[],
    password: string,
  ): Promise<IdentityImportResult> => {
    return this.platformAddressService.importIdentity(walletId, identityIdentifier, privateKeys, password)
  }
}
