import {DashPayWalletCache} from '../types/DashPay'

// DashPay and DPNS state in memory, not SQL: refreshDashPay rebuilds it from the
// network, and a restart starts every wallet empty.
export class DashPayCache {
  private wallets = new Map<string, DashPayWalletCache>()

  wallet = (walletId: string): DashPayWalletCache => {
    let entry = this.wallets.get(walletId)
    if (entry == null) {
      entry = {usernames: null, requests: null, contactKeys: new Map(), contactNames: new Map(), chains: new Map()}
      this.wallets.set(walletId, entry)
    }

    return entry
  }
}
