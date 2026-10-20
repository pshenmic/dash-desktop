import {AliasDAO} from '../../database/AliasDAO'
import {IdentityDAO} from '../../database/IdentityDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {IdentityInfo} from '../../types/Identity'
import {Network} from '../../types/Network'
import {Logger} from '../../utils/logger'
import {requireSelectedWallet, requireWallet} from '../../utils/requireWallet'
import {PlatformWorkerService} from './PlatformWorkerService'

const log = new Logger('identities')

// Reads the identities a wallet already owns. Creating them is
// IdentityRegistrationService — that path funds an asset lock, this one only
// resolves what the worker can see.
export class IdentityService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private aliasDAO: AliasDAO
  private platform: PlatformWorkerService

  constructor(walletDAO: WalletDAO, identityDAO: IdentityDAO, aliasDAO: AliasDAO, platform: PlatformWorkerService) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.aliasDAO = aliasDAO
    this.platform = platform
  }

  async getIdentities(walletId: string): Promise<IdentityInfo[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    const stored = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const [{infos}] = await Promise.all([
      this.platform.request('identityInfos', wallet.network, {
        identifiers: stored.map(entry => entry.identifier),
        skipDPNS: false,
      }),
      this.recheckAliases(walletId, wallet.network),
    ])
    const byIdentifier = new Map(infos.map(info => [info.identifier, info]))

    // An identity the worker could not resolve is not registered yet — skipped.
    return stored.flatMap(entry => {
      const info = byIdentifier.get(entry.identifier)
      if (info == null) return []
      // TODO: Implement read usd amount
      return [{
        identityIndex: entry.identityIndex,
        identifier: info.identifier,
        alias: info.alias,
        balance: {
          amount: info.balance,
          usdAmount: '0.0'
        },
        derivationPath: entry.derivationPath,
        assetLockTxid: entry.assetLockTxid ?? null
      }]
    })
  }

  // A pending name stays pending while the chain shows nothing: its domain
  // document or contest lands a block or two after the broadcast.
  private async recheckAliases(walletId: string, network: Network): Promise<void> {
    const unsettled = await this.aliasDAO.getUnsettled(walletId)
    await Promise.all(unsettled.map(async alias => {
      try {
        const check = await this.platform.request('aliasStatus', network, {identifier: alias.identifier, label: alias.label})
        const status = alias.status === 'pending' && check.status === 'missing' ? 'pending' : check.status
        await this.aliasDAO.save({...alias, ...check, status, checkedAt: Date.now()})
      } catch (err) {
        log.warn(`${alias.label}: alias check failed:`, err)
      }
    }))
  }

  // Feeds the credits half of the wallet balance, so it skips the DPNS lookup
  // the display list needs.
  async totalCredits(walletId: string, network: Network): Promise<bigint> {
    const stored = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const {infos} = await this.platform.request('identityInfos', network, {
      identifiers: stored.map(identity => identity.identifier),
      skipDPNS: true,
    })
    return infos.reduce((acc, info) => acc + info.balance, 0n)
  }

  async getIdentityBalance(identifier: string): Promise<bigint> {
    const wallet = await requireSelectedWallet(this.walletDAO)
    const {credits} = await this.platform.request('identityBalance', wallet.network, {identifier})
    return credits
  }

  async getIdentityNonce(identifier: string): Promise<bigint> {
    const wallet = await requireSelectedWallet(this.walletDAO)
    const {nonce} = await this.platform.request('identityNonce', wallet.network, {identifier})
    return nonce
  }
}
