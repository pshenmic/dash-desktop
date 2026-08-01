import {WalletSyncStatus} from '../../p2p/types/walletSync'
import {Network} from './index'

// Aggregated app status. Wallet-sync progress is folded in here rather
// than exposed via a separate IPC so the renderer has a single poll
// surface — when other status sources land (Platform sync, etc.) they'll
// nest under here too.
//
// `walletSync` is always populated (phase === 'stopped' when no utility
// process is running) — renderer never has to special-case null.
export interface AppStatus {
  ready: boolean
  selectedWalletId: string | null
  network: Network | null
  walletSync: WalletSyncStatus
}