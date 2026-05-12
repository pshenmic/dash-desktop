import {Network} from '../types'
import {Preferences} from '../preferences'
import {WalletProvider} from './WalletProvider'
import {InsightWalletProvider} from './InsightWalletProvider'
import {P2PWalletProvider} from './P2PWalletProvider'
import {TransactionDAO} from '../database/TransactionDAO'
import {AddressDAO} from '../database/AddressDAO'

// Picks a provider implementation based on the user's preference. Callers
// (services, IPC handlers) consume the WalletProvider interface and don't
// need to know which backend is active.
//
// Methods unsupported by the chosen backend (notably broadcastTx and
// getBlockByHash on the p2p provider) throw Error('Unimplemented') —
// callers can try/catch or surface the error to the user.
export class WalletProviderResolver {
  constructor(
    private readonly preferences: Preferences,
    private readonly transactionDAO: TransactionDAO,
    private readonly addressDAO: AddressDAO,
  ) {}

  for(walletId: string, network: Network): WalletProvider {
    if (this.preferences.general.walletInfoProvider === 'p2p') {
      return new P2PWalletProvider(this.transactionDAO, walletId)
    }
    return new InsightWalletProvider(network, walletId, this.addressDAO)
  }
}
