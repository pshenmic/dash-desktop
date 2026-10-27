import {HDKey} from '@scure/bip32'
import convertToHomographSafeChars from 'dash-platform-sdk/src/utils/convertToHomographSafeChars.js'
import {HD_VERSIONS} from '../../constants/addresses'
import {MAX_KEYS_PER_TRANSITION, MAX_KEYS_TO_DISABLE} from '../../constants/credits'
import {DashPayCache} from '../../database/DashPayCache'
import {IdentityDAO} from '../../database/IdentityDAO'
import {PlatformTransactionDAO} from '../../database/PlatformTransactionDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {Alias, AliasSearchResult} from '../../types/Alias'
import {DashPayContact} from '../../types/DashPay'
import {Identity, IdentityInfo} from '../../types/Identity'
import {IdentityKeysUpdate, IdentityPrivateKey} from '../../types/IdentityKeys'
import {Network} from '../../types/Network'
import {dashPayContacts} from '../../utils/dashPayContacts'
import {dashPayAccountPath} from '../../utils/dashPayKeys'
import {Logger} from '../../utils/logger'
import {requireSelectedWallet, requireWallet} from '../../utils/requireWallet'
import {withUnlockedWallet} from '../../utils/walletSeed'
import {PlatformExplorerProvider} from '../../providers/PlatformExplorerProvider'
import {PlatformWorkerService} from './PlatformWorkerService'

const log = new Logger('identities')

// The identities a wallet owns, their DPNS names and DashPay contacts, the last two in memory.
// Creating identities is IdentityRegistrationService — that path funds an asset lock.
export class IdentityService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private platformTransactionDAO: PlatformTransactionDAO
  private dashPayCache: DashPayCache
  private platform: PlatformWorkerService
  private dashPayRefreshes = new Map<string, Promise<void>>()

  constructor(walletDAO: WalletDAO, identityDAO: IdentityDAO, platformTransactionDAO: PlatformTransactionDAO, dashPayCache: DashPayCache, platform: PlatformWorkerService) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.platformTransactionDAO = platformTransactionDAO
    this.dashPayCache = dashPayCache
    this.platform = platform
  }

  async getIdentities(walletId: string): Promise<IdentityInfo[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    const stored = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const {infos} = await this.platform.request('identityInfos', wallet.network, {
      identifiers: stored.map(entry => entry.identifier),
      skipDPNS: false,
    })
    const byIdentifier = new Map(infos.map(info => [info.identifier, info]))

    // An identity the worker could not resolve is not registered yet — skipped.
    return stored.flatMap(entry => {
      const info = byIdentifier.get(entry.identifier)
      if (info == null) return []
      // TODO: Implement read usd amount
      return [{
        identityIndex: entry.identityIndex,
        identifier: info.identifier,
        alias: info.aliasesList[0] ?? null,
        aliasesList: info.aliasesList,
        keys: info.keys,
        balance: {
          amount: info.balance,
          usdAmount: '0.0'
        },
        derivationPath: entry.derivationPath,
        assetLockTxid: entry.assetLockTxid ?? null
      }]
    })
  }

  private async requireIdentity(walletId: string, identifier: string): Promise<Identity> {
    const identity = await this.identityDAO.getByIdentifier(walletId, identifier)
    if (identity == null) {
      throw new Error('Identity not found in this wallet')
    }
    return identity
  }

  // Requests never change, so only those since the newest known are fetched;
  // known ones keep the key decrypted from them in this process.
  async refreshDashPayRequests(walletId: string): Promise<void> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const identifiers = (await this.identityDAO.getIdentitiesByWalletId(walletId)).map(entry => entry.identifier)
    const cache = this.dashPayCache.wallet(walletId)
    const known = cache.requests ?? []

    const since = Math.max(0, ...known.map(request => request.createdAt))
    const pages = await Promise.all(identifiers.map(identifier => this.platform.request('dashPayContactRequests', wallet.network, {identifier, since})))
    const requests = new Map(known.map(request => [request.id, request]))
    for (const request of pages.flatMap(({sent, received}) => [...sent, ...received])) {
      if (!requests.has(request.id)) requests.set(request.id, request)
    }

    cache.requests = [...requests.values()].sort((a, b) => a.createdAt - b.createdAt)
  }

  // Every name with its contest, contact request and contact name, from the
  // network. Callers that arrive while one runs share it.
  refreshDashPay(walletId: string): Promise<void> {
    const running = this.dashPayRefreshes.get(walletId)
    if (running != null) return running

    const refresh = this.fetchDashPay(walletId).finally(() => this.dashPayRefreshes.delete(walletId))
    this.dashPayRefreshes.set(walletId, refresh)
    return refresh
  }

  private async fetchDashPay(walletId: string): Promise<void> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const identifiers = (await this.identityDAO.getIdentitiesByWalletId(walletId)).map(entry => entry.identifier)
    const cache = this.dashPayCache.wallet(walletId)

    await this.refreshDashPayRequests(walletId)
    const requests = cache.requests ?? []
    const contactIds = [...new Set(dashPayContacts(requests, identifiers).map(contact => contact.contactId))]

    const [{infos}, {contests}] = await Promise.all([
      this.platform.request('identityInfos', wallet.network, {identifiers: [...identifiers, ...contactIds], skipDPNS: false}),
      this.runningContests(wallet.network, identifiers),
    ])
    const names = new Map(infos.map(info => [info.identifier, info.aliasesList]))

    // A contested name has no domain document while its vote runs, so one this
    // process knows stays listed until the vote settles it.
    const found = [
      ...(cache.aliases ?? []).filter(alias => alias.status === 'voting'),
      ...identifiers.flatMap(identifier => (names.get(identifier) ?? []).map(name => ({identifier, label: name.split('.')[0]}))),
      ...contests,
    ]

    const candidates = new Map(found.map(({identifier, label}) => [`${identifier}:${convertToHomographSafeChars(label)}`, {identifier, label}]))
    // A name whose check fails keeps what was known of it.
    const aliases = await Promise.all([...candidates.values()].map(async ({identifier, label}): Promise<Alias | undefined> => {
      const normalizedLabel = convertToHomographSafeChars(label)
      try {
        return {...await this.platform.request('aliasStatus', wallet.network, {identifier, label}), identifier, label, normalizedLabel}
      } catch (err) {
        log.warn(`${label}: alias check failed:`, err)
        return cache.aliases?.find(alias => alias.identifier === identifier && alias.normalizedLabel === normalizedLabel)
      }
    }))

    cache.contactNames = new Map(contactIds.map(contactId => [contactId, names.get(contactId) ?? []]))
    cache.aliases = aliases.filter(alias => alias != null)
    log.info(`${walletId}: refreshed ${aliases.length} name(s), ${requests.length} contact request(s)`)
  }

  // Contests found elsewhere, on another device or before a restart. Without the
  // explorer only those known to this process stay listed.
  private async runningContests(network: Network, identifiers: string[]): Promise<{contests: Array<{identifier: string; label: string}>}> {
    try {
      const labels = await new PlatformExplorerProvider(network, this.platformTransactionDAO).runningDpnsContests()
      return await this.platform.request('aliasContests', network, {labels, identifiers})
    } catch (err) {
      log.warn('running contests not listed:', err)
      return {contests: []}
    }
  }

  async getDashPayContacts(walletId: string): Promise<DashPayContact[]> {
    const cache = this.dashPayCache.wallet(walletId)
    if (cache.requests == null) await this.refreshDashPay(walletId)

    const identifiers = (await this.identityDAO.getIdentitiesByWalletId(walletId)).map(entry => entry.identifier)
    return dashPayContacts(cache.requests ?? [], identifiers)
      .map(contact => ({...contact, aliasesList: cache.contactNames.get(contact.contactId) ?? []}))
  }

  // Accepting a request is sending one back, so this does both.
  async sendDashPayContactRequest(walletId: string, identifier: string, recipient: string, password: string): Promise<DashPayContact[]> {
    const identity = await this.requireIdentity(walletId, identifier)
    if (recipient === identifier) {
      throw new Error('An identity cannot send a contact request to itself')
    }

    log.info(`contact request ${identifier} -> ${recipient}: sending`)
    await withUnlockedWallet(this.walletDAO, walletId, password, async ({wallet, seed}) => {
      const {stHash} = await this.platform.request('dashPayContactRequestSend', wallet.network, {
        seed, identifier, identityIndex: identity.identityIndex, recipient,
      })
      log.info(`contact request ${identifier} -> ${recipient}: sent ${stHash}`)

      // Our chain for them derives from this key; a wallet older than the column has none yet.
      if (wallet.dashPayXpub == null) {
        const account = HDKey.fromMasterSeed(seed, HD_VERSIONS[wallet.network]).derive(dashPayAccountPath(wallet.network))
        await this.walletDAO.setDashPayXpub(walletId, account.publicExtendedKey)
      }
      // Sent by now, so a failed refresh must not report the request as not sent.
      await this.refreshDashPay(walletId).catch(err => log.warn(`contact request ${identifier} -> ${recipient}: not refreshed:`, err))

      // Accepting holds the seed anyway, so the key they sent us is decrypted now.
      const theirs = this.dashPayCache.wallet(walletId).requests?.some(request => request.ownerId === recipient && request.toUserId === identifier)
      if (theirs) {
        await this.dashPayContactXpub(walletId, wallet.network, seed, identifier, recipient)
          .catch(err => log.warn(`contact request ${recipient} -> ${identifier}: key not decrypted:`, err))
      }
    })
    return this.getDashPayContacts(walletId)
  }

  // The key a contact sent us to pay them on is encrypted to our DECRYPTION key,
  // so it is decrypted inside an unlock the caller already holds, then kept in memory.
  async dashPayContactXpub(walletId: string, network: Network, seed: Uint8Array, identifier: string, contactId: string): Promise<string> {
    const cache = this.dashPayCache.wallet(walletId)
    if (cache.requests == null) await this.refreshDashPay(walletId)

    const identity = await this.identityDAO.getByIdentifier(walletId, identifier)
    const request = cache.requests?.findLast(request => request.ownerId === contactId && request.toUserId === identifier)
    if (identity == null || request == null) {
      throw new Error('This contact has not sent this identity a contact request')
    }
    if (request.contactXpub != null) return request.contactXpub

    const broken = 'Payments to this contact are unavailable — ask them to send you a new contact request'
    if (request.paymentChannelBroken) throw new Error(broken)

    const {xpub} = await this.platform.request('dashPayContactKey', network, {seed, identifier, identityIndex: identity.identityIndex, request})
    if (xpub == null) {
      request.paymentChannelBroken = true
      throw new Error(broken)
    }

    request.contactXpub = xpub
    log.info(`contact request ${contactId} -> ${identifier}: key decrypted`)
    return xpub
  }

  async getAliases(walletId: string): Promise<Alias[]> {
    const cache = this.dashPayCache.wallet(walletId)
    if (cache.aliases == null) await this.refreshDashPay(walletId)

    return cache.aliases ?? []
  }

  async searchAliases(walletId: string, prefix: string): Promise<AliasSearchResult[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const {results} = await this.platform.request('aliasSearch', wallet.network, {prefix})
    return results
  }

  async registerAlias(walletId: string, identifier: string, label: string, password: string): Promise<Alias> {
    const identity = await this.requireIdentity(walletId, identifier)

    log.info(`${label}: registering for ${identifier}`)
    const check = await withUnlockedWallet(this.walletDAO, walletId, password, ({wallet, seed}) =>
      this.platform.request('aliasRegister', wallet.network, {seed, identifier, identityIndex: identity.identityIndex, label}))

    const alias: Alias = {...check, identifier, label, normalizedLabel: convertToHomographSafeChars(label)}

    // Paid for by now, so a failed refresh must not report it as not registered.
    const cache = this.dashPayCache.wallet(walletId)
    if (cache.aliases == null) await this.refreshDashPay(walletId).catch(err => log.warn(`${label}: names not refreshed:`, err))
    cache.aliases = [...(cache.aliases ?? []).filter(known => known.identifier !== identifier || known.normalizedLabel !== alias.normalizedLabel), alias]

    log.info(`${label}: ${alias.status}`)
    return alias
  }

  async getIdentityPrivateKeys(walletId: string, identifier: string, password: string): Promise<IdentityPrivateKey[]> {
    const identity = await this.requireIdentity(walletId, identifier)

    log.info(`${identifier}: revealing its private keys`)
    const {keys} = await withUnlockedWallet(this.walletDAO, walletId, password, ({wallet, seed}) =>
      this.platform.request('identityPrivateKeys', wallet.network, {seed, identifier, identityIndex: identity.identityIndex}))
    return keys
  }

  // Disabling is final: Platform has no way to enable a key again.
  async updateIdentityKeys(walletId: string, identifier: string, {add, disable}: IdentityKeysUpdate, password: string): Promise<string> {
    const identity = await this.requireIdentity(walletId, identifier)

    if (add.length === 0 && disable.length === 0) {
      throw new Error('Choose a key to add or disable')
    }
    if (add.length > MAX_KEYS_PER_TRANSITION) {
      throw new Error(`Add at most ${MAX_KEYS_PER_TRANSITION} keys at a time`)
    }
    if (disable.length > MAX_KEYS_TO_DISABLE) {
      throw new Error(`Disable at most ${MAX_KEYS_TO_DISABLE} keys at a time`)
    }
    if (new Set(disable).size !== disable.length) {
      throw new Error('A key is listed twice')
    }

    log.info(`${identifier}: adding ${add.map(key => `${key.purpose} ${key.securityLevel}`).join(', ') || 'no keys'}, disabling ${disable.join(', ') || 'none'}`)
    const {stHash} = await withUnlockedWallet(this.walletDAO, walletId, password, ({wallet, seed}) =>
      this.platform.request('identityUpdateKeys', wallet.network, {seed, identifier, identityIndex: identity.identityIndex, add, disable}))
    log.info(`${identifier}: keys updated in ${stHash}`)
    return stHash
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
