import {Transaction as SDKTransaction, utils as coreUtils} from 'dash-core-sdk'
import type {ChainAssetLockProofParams} from 'dash-core-sdk/src/utils.js'
import {OrchardAddressWASM} from 'pshenmic-dpp'
import {WalletDAO} from '../../database/WalletDAO'
import {AddressDAO} from '../../database/AddressDAO'
import {IdentityDAO} from '../../database/IdentityDAO'
import {PlatformAddressDAO} from '../../database/PlatformAddressDAO'
import {AssetLockService} from './AssetLockService'
import {PlatformWorkerService} from './PlatformWorkerService'
import {WalletSyncService} from '../core/WalletSyncService'
import {AssetLockFundingStatus} from '../../enums/AssetLockFundingStatus'
import {AssetLockFundingState} from '../../types/AssetLockFunding'
import {
  AssetLockCredit,
  AssetLockCreditOwner,
  AssetLockInspection,
  AssetLockLockStatus,
  AssetLockRecoveryDestination,
} from '../../types/AssetLockRecovery'
import {Network} from '../../types/Network'
import {Wallet} from '../../types/Wallet'
import {ASSET_LOCK_CREDIT_OUTPUT_INDEX, ASSET_LOCK_RECOVERY_KINDS} from '../../constants/credits'
import {FUNDING_KEY_SCAN_LIMIT} from '../../constants/addresses'
import {assetLockCredit, assetLockIdentityId, recoveryFundingKind, requireTxid} from '../../utils/assetLockRecovery'
import {findDerivedAddress, fundingAddressDeriver, fundingXpubs} from '../../utils/fundingKeys'
import {nextIdentityIndex} from '../../utils/identityKeys'
import {isGrpcNotFound} from '../../utils/sdkErrors'
import {unlockWallet, zeroSeed} from '../../utils/walletSeed'
import {requireWallet} from '../../utils/requireWallet'
import {coreSDK} from '../../utils/coreSDK'

// Matches an asset lock's credit output to the wallet key that owns it and
// hands the lock to AssetLockService as a resumable funding.
export class AssetLockRecoveryService {
  constructor(
    private readonly walletDAO: WalletDAO,
    private readonly addressDAO: AddressDAO,
    private readonly identityDAO: IdentityDAO,
    private readonly platformAddressDAO: PlatformAddressDAO,
    private readonly assetLock: AssetLockService,
    private readonly platform: PlatformWorkerService,
    private readonly walletSyncService: WalletSyncService,
  ) {}

  async inspect(walletId: string, input: string): Promise<AssetLockInspection> {
    const txid = requireTxid(input)
    const wallet = await requireWallet(this.walletDAO, walletId)
    const {credit, owner, height, dapiLockStatus} = await this.locate(wallet, txid)

    const recorded = await this.assetLock.getFunding(txid)
    if (recorded != null && recorded.walletId !== walletId) {
      throw new Error('This asset lock is recorded by another wallet')
    }
    const identity = owner.source === 'registration' ? await this.registeredIdentity(wallet.network, txid) : null

    return {
      txid,
      ...credit,
      ...owner,
      allowedKinds: ASSET_LOCK_RECOVERY_KINDS[owner.source],
      recorded: recorded == null
        ? null
        : {status: recorded.status, kind: recorded.kind, to: recorded.toPlatformAddress === '' ? null : recorded.toPlatformAddress},
      // Whichever source saw it: DAPI's own node tracks lock state past this
      // session's lifetime, ours only from when its pool last connected.
      lockStatus: this.orLockStatus(dapiLockStatus, this.lockStatus(wallet.network, txid, height)),
      identityId: identity?.identifier ?? null,
      identityExists: identity?.exists ?? null,
    }
  }

  async recover(walletId: string, input: string, password: string, destination: AssetLockRecoveryDestination): Promise<AssetLockFundingState> {
    const txid = requireTxid(input)
    const unlocked = await unlockWallet(this.walletDAO, walletId, password)
    try {
      const wallet = {...unlocked.wallet, ...await fundingXpubs(this.walletDAO, unlocked.wallet, unlocked.seed)}
      const {tx, credit, owner, height} = await this.locate(wallet, txid)
      // The proof we attach has to be ours to vouch for, not DAPI's say-so —
      // display can trust either source, building one cannot.
      const kind = recoveryFundingKind(owner.source, destination)
      const to = await this.requireDestination(wallet, destination)

      // Already chainlocked per our own pool: hand resume the proof now so it
      // does not repeat a wait whose answer we already have.
      const {chainLocked} = this.lockStatus(wallet.network, txid, height)
      const proof: ChainAssetLockProofParams | undefined = chainLocked
        ? coreUtils.createAssetLockProof({transaction: tx, coreChainLockedHeight: height, outputIndex: ASSET_LOCK_CREDIT_OUTPUT_INDEX}) as ChainAssetLockProofParams
        : undefined

      // The registration key only signs for the lock; a registration made since it
      // was orphaned may already own the identity index matching the key's.
      let identityIndex: number | null = owner.source === 'topUp' ? owner.index : null
      if (owner.source === 'registration') {
        const {identifier, exists} = await this.registeredIdentity(wallet.network, txid)
        if (exists) {
          throw new Error(`Identity ${identifier} was already created from this asset lock`)
        }
        identityIndex = await nextIdentityIndex(this.identityDAO, this.platform, walletId, unlocked.seed, wallet.network)
      }

      return await this.assetLock.adopt({
        walletId,
        txid,
        outputIndex: ASSET_LOCK_CREDIT_OUTPUT_INDEX,
        creditDerivationPath: owner.derivationPath,
        amountDuffs: credit.amountDuffs,
        toPlatformAddress: to,
        kind,
        status: proof != null ? AssetLockFundingStatus.ChainLocked : AssetLockFundingStatus.L1Broadcast,
        identityIndex,
        txHex: tx.hex(),
        createdAt: Math.floor(Date.now() / 1000),
      }, proof)
    } finally {
      zeroSeed(unlocked)
    }
  }

  // DAPI rather than the provider: the wallet's own store only holds the parsed
  // transaction, and the resume needs the raw one to build its proof.
  private async locate(wallet: Wallet, txid: string): Promise<{tx: SDKTransaction; credit: AssetLockCredit; owner: AssetLockCreditOwner; height: number; dapiLockStatus: AssetLockLockStatus}> {
    const found = await coreSDK(wallet.network).getTransaction(txid).catch(error => {
      if (isGrpcNotFound(error)) return null
      throw error
    })
    if (found == null) {
      throw new Error(`Transaction ${txid} was not found on the network`)
    }
    const tx = SDKTransaction.fromBytes(found.transaction)
    if (tx.hash() !== txid) {
      throw new Error(`The network returned transaction ${tx.hash()} for ${txid}`)
    }

    const credit = assetLockCredit(tx, wallet.network)
    const owner = await this.creditOwner(wallet, credit.address)
    if (owner == null) {
      throw new Error(wallet.registrationFundingXpub == null || wallet.topUpFundingXpub == null
        ? 'The credit output is not on an L1 address of this wallet. Unlock the wallet once so its identity funding keys can be checked'
        : 'The credit output of this asset lock does not belong to this wallet')
    }
    return {
      tx, credit, owner, height: found.height,
      dapiLockStatus: {instantLocked: found.isInstantLocked, chainLocked: found.isChainLocked},
    }
  }

  private orLockStatus(a: AssetLockLockStatus, b: AssetLockLockStatus): AssetLockLockStatus {
    return {instantLocked: a.instantLocked || b.instantLocked, chainLocked: a.chainLocked || b.chainLocked}
  }

  // Registration and top-up credit addresses are never in the cfilter watch
  // list, so there is no local row for them to read a lock status off of —
  // chainlocked height and the islock cache are both txid/height keyed, not
  // address keyed, and answer for any lock this wallet knows the txid of. This
  // is the only source recover may build a proof from: DAPI's say-so is fine to
  // display, not to vouch for cryptographically.
  private lockStatus(network: Network, txid: string, height: number): AssetLockLockStatus {
    return {
      instantLocked: this.walletSyncService.hasInstantLock(txid),
      chainLocked: height > 0 && height <= this.walletSyncService.chainlockedHeight(network),
    }
  }

  private async creditOwner(wallet: Wallet, address: string): Promise<AssetLockCreditOwner | null> {
    // core (shield/platform address)
    const {receiving, change} = await this.addressDAO.getAddressesByWalletId(wallet.walletId)
    const core = [...change, ...receiving].find(candidate => candidate.address === address)
    if (core != null) {
      return {source: 'core', index: core.index, derivationPath: core.derivationPath}
    }

    // identity
    const branches = [
      {usage: 'registration', xpub: wallet.registrationFundingXpub},
      {usage: 'topUp', xpub: wallet.topUpFundingXpub},
    ] as const
    for (const {usage, xpub} of branches) {
      if (xpub == null) continue
      const derived = findDerivedAddress(fundingAddressDeriver(xpub, wallet.network, usage), address, FUNDING_KEY_SCAN_LIMIT)
      if (derived != null) {
        return {source: usage, index: derived.index, derivationPath: derived.derivationPath}
      }
    }
    return null
  }

  private async requireDestination(wallet: Wallet, destination: AssetLockRecoveryDestination): Promise<string> {
    if (destination.kind === 'identity') return ''

    const to = destination.to.trim()
    switch (destination.kind) {
      case 'address': {
        const owned = await this.platformAddressDAO.getAddresses(wallet.walletId)
        if (!owned.some(candidate => candidate.address === to)) {
          throw new Error('Destination is not a platform address of this wallet')
        }
        break
      }
      case 'shielded':
        try {
          OrchardAddressWASM.fromBech32m(to)
        } catch {
          throw new Error('Invalid shielded recipient address')
        }
        break
      case 'identityTopUp':
        if (await this.identityDAO.getByIdentifier(wallet.walletId, to) == null) {
          throw new Error('Destination is not an identity of this wallet')
        }
        break
    }
    return to
  }

  // identityExists reads a failed lookup as absent, so an outage lets recovery
  // through and a spent lock is refused by Platform at resume instead.
  private async registeredIdentity(network: Network, txid: string): Promise<{identifier: string; exists: boolean}> {
    const identifier = assetLockIdentityId(txid)
    const {exists} = await this.platform.request('identityExists', network, {identifier})
    return {identifier, exists}
  }
}
