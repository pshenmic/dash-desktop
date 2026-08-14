import type {Network} from '../../src/types'
import type {AppliedBlock, GapExhausted, WalletSyncStatus} from './walletSync'
import type {BroadcastResult} from './broadcast'

export interface SyncServiceEvents {
  status: (status: WalletSyncStatus) => void
  blockApplied: (block: AppliedBlock) => void
  cursorAdvanced: (walletId: string, height: number) => void
  cursorReset: (walletId: string, height: number) => void
  chainRewound: (walletId: string, height: number) => void
  gapExhausted: (gap: GapExhausted) => void
  error: (message: string) => void
  broadcastResult: (
    requestId: string,
    ok: boolean,
    result: BroadcastResult,
    errorMessage: string | null,
  ) => void
  txInstantLocked: (txid: string, islockHex: string) => void
  chainLocked: (network: Network, height: number) => void
}
