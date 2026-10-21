import {HDKey} from '@scure/bip32'
import convertToHomographSafeChars from 'dash-platform-sdk/src/utils/convertToHomographSafeChars.js'
import {HD_VERSIONS} from '../../constants/addresses'
import {AliasDAO} from '../../database/AliasDAO'
import {DashPayContactRequestDAO} from '../../database/DashPayContactRequestDAO'
import {IdentityDAO} from '../../database/IdentityDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {Alias, AliasSearchResult} from '../../types/Alias'
import {DashPayContact} from '../../types/DashPay'
import {IdentityInfo} from '../../types/Identity'
import {IdentityKeyRequest} from '../../types/IdentityKeys'
import {Network} from '../../types/Network'
import {dashPayContacts} from '../../utils/dashPayContacts'
import {dashPayAccountPath} from '../../utils/dashPayKeys'
import {Logger} from '../../utils/logger'
import {requireSelectedWallet, requireWallet} from '../../utils/requireWallet'
import {withUnlockedWallet} from '../../utils/walletSeed'
import {PlatformWorkerService} from './PlatformWorkerService'

const log = new Logger('identities')

// Reads the identities a wallet already owns, registers their DPNS names and
// keeps their DashPay contact requests.
// Creating identities is IdentityRegistrationService — that path funds an asset lock.
export class IdentityService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private aliasDAO: AliasDAO
  private dashPayContactRequestDAO: DashPayContactRequestDAO
  private platform: PlatformWorkerService

  constructor(walletDAO: WalletDAO, identityDAO: IdentityDAO, aliasDAO: AliasDAO, dashPayContactRequestDAO: DashPayContactRequestDAO, platform: PlatformWorkerService) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.aliasDAO = aliasDAO
    this.dashPayContactRequestDAO = dashPayContactRequestDAO
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

  // A pending name stays pending while the chain shows nothing: its domain
  // document or contest lands a block or two after the broadcast.
  private async recheckAliases(walletId: string, network: Network, infos: Array<{identifier: string; aliasesList: string[]}>): Promise<void> {
    const stored = await this.aliasDAO.getAliases(walletId)
    const unsettled = stored.filter(alias => alias.status === 'pending' || alias.status === 'voting')
    // A name the chain shows with no row here was registered elsewhere, or before this database.
    const unknown = infos.flatMap(({identifier, aliasesList}) => aliasesList.map(name => {
      const [label] = name.split('.')
      return {walletId, identifier, label, normalizedLabel: convertToHomographSafeChars(label), status: 'missing' as const, preorderSalt: null, createdAt: Date.now()}
    })).filter(alias => !stored.some(known => known.identifier === alias.identifier && known.normalizedLabel === alias.normalizedLabel))
    await Promise.all([...unsettled, ...unknown].map(async alias => {
      try {
        const check = await this.platform.request('aliasStatus', network, {identifier: alias.identifier, label: alias.label})
        const status = alias.status === 'pending' && check.status === 'missing' ? 'pending' : check.status
        if (status !== alias.status) log.info(`${alias.label}: ${alias.status} -> ${status}`)
        await this.aliasDAO.save({...alias, ...check, status, checkedAt: Date.now()})
      } catch (err) {
        log.warn(`${alias.label}: alias check failed:`, err)
      }
    }))
  }

  // Each identity asks only for what is newer than its newest stored request.
  private async recheckDashPayContactRequests(walletId: string, network: Network, identifiers: string[]): Promise<void> {
    const stored = await this.dashPayContactRequestDAO.getContactRequests(walletId)
    await Promise.all(identifiers.map(async identifier => {
      const own = stored.filter(request => request.ownerId === identifier || request.toUserId === identifier)
      try {
        const {sent, received} = await this.platform.request('dashPayContactRequests', network, {
          identifier,
          since: Math.max(0, ...own.map(request => request.createdAt)),
        })
        const fresh = [...sent, ...received].filter(request => !own.some(known => known.id === request.id))
        for (const request of fresh) log.info(`contact request ${request.ownerId} -> ${request.toUserId} found`)
        await this.dashPayContactRequestDAO.saveAll(walletId, fresh)
      } catch (err) {
        log.warn(`${identifier}: contact request check failed:`, err)
      }
    }))
  }

  // Names are read live: one can be registered or transferred at any time.
  async getDashPayContacts(walletId: string): Promise<DashPayContact[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const identities = await this.identityDAO.getIdentitiesByWalletId(walletId)
    await this.recheckDashPayContactRequests(walletId, wallet.network, identities.map(entry => entry.identifier))
    const contacts = dashPayContacts(await this.dashPayContactRequestDAO.getContactRequests(walletId), identities.map(entry => entry.identifier))
    if (contacts.length === 0) return contacts
    const {infos} = await this.platform.request('identityInfos', wallet.network, {
      identifiers: [...new Set(contacts.map(contact => contact.contactId))],
      skipDPNS: false,
    })
    const names = new Map(infos.map(info => [info.identifier, info.aliasesList]))
    return contacts.map(contact => ({...contact, aliasesList: names.get(contact.contactId) ?? []}))
  }

  // Accepting a request is sending one back, so this does both.
  async sendDashPayContactRequest(walletId: string, identifier: string, recipient: string, password: string): Promise<DashPayContact[]> {
    const identity = await this.identityDAO.getByIdentifier(walletId, identifier)
    if (identity == null) {
      throw new Error('Identity not found in this wallet')
    }
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
      await this.recheckDashPayContactRequests(walletId, wallet.network, [identifier])
      // Accepting holds the seed anyway, so the key they sent us is stored now.
      const theirs = (await this.dashPayContactRequestDAO.getContactRequests(walletId))
        .some(request => request.ownerId === recipient && request.toUserId === identifier)
      if (theirs) {
        await this.dashPayContactXpub(walletId, wallet.network, seed, identifier, recipient)
          .catch(err => log.warn(`contact request ${recipient} -> ${identifier}: key not decrypted:`, err))
      }
    })
    return this.getDashPayContacts(walletId)
  }

  // The key a contact sent us to pay them on is encrypted to our DECRYPTION key,
  // so it is decrypted inside an unlock the caller already holds, then kept.
  async dashPayContactXpub(walletId: string, network: Network, seed: Uint8Array, identifier: string, contactId: string): Promise<string> {
    const identity = await this.identityDAO.getByIdentifier(walletId, identifier)
    const request = (await this.dashPayContactRequestDAO.getContactRequests(walletId))
      .findLast(request => request.ownerId === contactId && request.toUserId === identifier)
    if (identity == null || request == null) {
      throw new Error('This contact has not sent this identity a contact request')
    }
    if (request.contactXpub != null) return request.contactXpub
    const broken = 'Payments to this contact are unavailable — ask them to send you a new contact request'
    if (request.paymentChannelBroken) throw new Error(broken)
    const {xpub} = await this.platform.request('dashPayContactKey', network, {seed, identifier, identityIndex: identity.identityIndex, request})
    if (xpub == null) {
      await this.dashPayContactRequestDAO.setPaymentChannelBroken(walletId, request.id)
      throw new Error(broken)
    }
    await this.dashPayContactRequestDAO.setContactXpub(walletId, request.id, xpub)
    log.info(`contact request ${contactId} -> ${identifier}: key stored`)
    return xpub
  }

  async getAliases(walletId: string): Promise<Alias[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const {infos} = await this.platform.request('identityInfos', wallet.network, {
      identifiers: (await this.identityDAO.getIdentitiesByWalletId(walletId)).map(entry => entry.identifier),
      skipDPNS: false,
    })
    await this.recheckAliases(walletId, wallet.network, infos)
    return this.aliasDAO.getAliases(walletId)
  }

  async resolveAlias(walletId: string, label: string): Promise<string | null> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const {identifier} = await this.platform.request('aliasResolve', wallet.network, {label})
    return identifier
  }

  async searchAliases(walletId: string, prefix: string): Promise<AliasSearchResult[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const {results} = await this.platform.request('aliasSearch', wallet.network, {prefix})
    return results
  }

  async registerAlias(walletId: string, identifier: string, label: string, password: string): Promise<Alias> {
    const identity = await this.identityDAO.getByIdentifier(walletId, identifier)
    if (identity == null) {
      throw new Error('Identity not found in this wallet')
    }

    // Registering a name again resumes a preorder an earlier attempt paid for.
    const normalizedLabel = convertToHomographSafeChars(label)
    const earlier = (await this.aliasDAO.getAliases(walletId))
      .find(alias => alias.identifier === identifier && alias.normalizedLabel === normalizedLabel)

    const preorderSalt = earlier?.preorderSalt ?? null
    log.info(`${label}: registering for ${identifier}${preorderSalt == null ? '' : ', resuming its paid preorder'}`)
    const {error, ...check} = await withUnlockedWallet(this.walletDAO, walletId, password, ({wallet, seed}) =>
      this.platform.request('aliasRegister', wallet.network, {
        seed, identifier, identityIndex: identity.identityIndex, label, preorderSalt,
      }))
    const now = Date.now()
    const status = error == null ? 'pending' : 'missing'
    const alias: Alias = {...check, walletId, identifier, label, normalizedLabel, status, createdAt: now, checkedAt: now}
    await this.aliasDAO.save(alias)
    if (error != null) {
      log.warn(`${label}: domain refused after its preorder, salt kept to resume: ${error}`)
      throw new Error(error)
    }
    log.info(`${label}: sent, pending`)
    return alias
  }

  async createIdentityKeys(walletId: string, identifier: string, keys: IdentityKeyRequest[], password: string): Promise<string> {
    const identity = await this.identityDAO.getByIdentifier(walletId, identifier)
    if (identity == null) {
      throw new Error('Identity not found in this wallet')
    }
    if (keys.length === 0) {
      throw new Error('Choose at least one key to create')
    }

    log.info(`${identifier}: creating ${keys.map(key => `${key.purpose} ${key.securityLevel}`).join(', ')}`)
    const {stHash} = await withUnlockedWallet(this.walletDAO, walletId, password, ({wallet, seed}) =>
      this.platform.request('identityCreateKeys', wallet.network, {seed, identifier, identityIndex: identity.identityIndex, keys}))
    log.info(`${identifier}: keys created in ${stHash}`)
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
