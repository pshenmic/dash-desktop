import { IpcMainInvokeEvent } from 'electron/utility'
import {ShieldedSpendSource} from '../../types/ShieldedNoteSelection'
import {ShieldedService} from '../../services/platform/ShieldedService'
import {ShieldedSpendState} from '../../types/Shielded'
export class StartShieldedTransferHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, recipient: string, amountCredits: bigint, password: string, source?: ShieldedSpendSource): Promise<ShieldedSpendState> => {
    return this.shieldedService.startTransfer(walletId, password, recipient, amountCredits, source)
  }
}
