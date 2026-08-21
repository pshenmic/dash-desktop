import {WalletSyncStatus} from '../../p2p/types/walletSync'
import {ConnectionStatus} from './Connection'
import {Network} from './Network'

// Aggregated app status. Wallet-sync progress is folded in rather than exposed
// via its own IPC so the renderer has a single poll surface.
//
// `walletSync` is always populated (phase === 'stopped' when no utility process
// is running) — renderer never has to special-case null.
export interface AppStatus {
  ready: boolean
  selectedWalletId: string | null
  network: Network | null
  connectionStatus: ConnectionStatus | null
  walletSync: WalletSyncStatus
}
