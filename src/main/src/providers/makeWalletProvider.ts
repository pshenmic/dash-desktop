import {Network} from '../types'
import {WalletProvider} from './WalletProvider'
import {InsightWalletProvider} from './InsightWalletProvider'
import {P2PWalletProvider} from './P2PWalletProvider'
import {ApplicationService} from '../services/ApplicationService'
import {AddressDAO} from '../database/AddressDAO'
import {TransactionDAO} from '../database/TransactionDAO'

// Picks the WalletProvider for a wallet at call time, honouring the user's
// connection-type preference. Wires Insight as broadcast fallback into
// P2PWalletProvider — until native P2P inv/tx broadcast lands, send in
// p2p mode hops over to Insight transparently instead of throwing.
export function makeWalletProvider(
  applicationService: ApplicationService,
  addressDAO: AddressDAO,
  transactionDAO: TransactionDAO,
  walletId: string,
  network: Network,
): WalletProvider {
  const insight = new InsightWalletProvider(network, walletId, addressDAO)
  if (applicationService.preferences.general.connectionType === 'p2p') {
    return new P2PWalletProvider(transactionDAO, walletId, insight)
  }
  return insight
}

// Closure type — bound once at boot, injected into services that need to
// resolve a provider per-call without knowing how it's wired.
export type ProviderResolver = (walletId: string, network: Network) => WalletProvider
