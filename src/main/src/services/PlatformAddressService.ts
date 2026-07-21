import type {DashPlatformSDK} from 'dash-platform-sdk'
import {SdkProvider} from './SdkProvider'
import {
  InputAddressWASM,
  OutputAddressWASM,
  AddressFundsFeeStrategyStepWASM,
  AddressWitnessWASM,
  AddressFundsTransferTransitionWASM,
  IdentityTopUpFromAddressesTransitionWASM,
  AddressCreditWithdrawalTransitionWASM,
  IdentityCreateFromAddressesTransitionWASM,
  IdentityPublicKeyInCreationWASM,
  PrivateKeyWASM,
  IdentityPublicKeyWASM,
} from 'dash-platform-sdk/types.js'
import {WalletDAO} from '../database/WalletDAO'
import {ShieldedService} from './ShieldedService'
import {IdentityDAO} from '../database/IdentityDAO'
import {Network} from '../types'
import {Wallet} from '../types/Wallet'
import {Identity} from '../types/Identity'
import {PlatformAddressEntry} from '../types/PlatformAddress'
import {PlatformSendResult} from '../types/PlatformSendResult'
import {IdentityCreateResult} from '../types/IdentityCreateResult'
import {ShieldResult} from '../types/ShieldResult'
import {decryptMnemonic} from '../utils'
import {coreAddressToScript} from '../utils/coreScript'
import {matchIdentityKey, DerivedKeyHash} from '../utils/identityKeys'
import {
  PlatformSourceCandidate,
  selectPlatformSource,
  selectPlatformInputsWithFee,
  topUpFeeCredits,
  TRANSFER_FEE_CREDITS,
  WITHDRAWAL_FEE_CREDITS,
  CORE_FEE_PER_BYTE,
  MAX_RECIPIENTS,
  MIN_OUTPUT_CREDITS,
  identityTransferFeeCredits,
  identityCreateFeeCredits,
  IDENTITY_CREDIT_TRANSFER_FEE_CREDITS,
} from '../utils/platformTransfer'

const PLATFORM_ACCOUNT = 0
const PLATFORM_ADDRESS_LOOKAHEAD = 20
const IDENTITY_KEY_LOOKAHEAD = 20
const MAX_DISCOVERY_BATCHES = 50
const COIN_TYPE: Record<Network, number> = {mainnet: 5, testnet: 1}

// Platform (L2) addresses follow DIP-17: m/9'/coinType'/17'/account'/0'/index.
// The account-level xpub is persisted per wallet so the address list derives
// publicly (no password); spends derive the index key from the seed.
export class PlatformAddressService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private sdkProvider: SdkProvider
  private shieldedService: ShieldedService

  constructor(walletDAO: WalletDAO, identityDAO: IdentityDAO, sdkProvider: SdkProvider, shieldedService: ShieldedService) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.sdkProvider = sdkProvider
    this.shieldedService = shieldedService
  }

  private platformSDK(network: Network): DashPlatformSDK {
    return this.sdkProvider.getPlatformSDK(network)
  }

  async getPlatformAddresses(walletId: string): Promise<PlatformAddressEntry[]> {
    const wallet = await this.requireWallet(walletId)

    if (wallet.platformXpub == null) {
      return []
    }

    await this.extendPlatformWindow(walletId, wallet.platformXpub, wallet.network)

    const candidates = await this.loadPlatformCandidates(walletId, wallet.platformXpub, wallet.network)
    return candidates.map(candidate => ({
      platformAddress: candidate.platformAddress,
      balanceCredits: candidate.balanceCredits.toString(),
      nonce: candidate.nonce,
    }))
  }

  async addPlatformAddress(walletId: string): Promise<PlatformAddressEntry[]> {
    const wallet = await this.requireWallet(walletId)

    if (wallet.platformXpub == null) {
      throw new Error('Platform addresses are not derived yet')
    }

    const count = await this.walletDAO.getPlatformAddressCount(walletId)
    await this.walletDAO.setPlatformAddressCount(walletId, count + 1)

    return this.getPlatformAddresses(walletId)
  }

  async sendPlatformTransfer(
    walletId: string,
    fromPlatformAddress: string,
    toPlatformAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Send amount must be greater than zero')
    }

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)

    const source = selectPlatformSource(candidates, amountCredits, fromPlatformAddress || undefined)

    if (toPlatformAddress === source.platformAddress) {
      throw new Error('Recipient must be different from the source address')
    }

    const inputs = [new InputAddressWASM(source.platformAddress, source.nonce + 1, amountCredits)]
    const outputs = [new OutputAddressWASM(toPlatformAddress, amountCredits)]
    const feeStrategy = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

    const unsignedSt = this.platformSDK(network).platformAddresses.createStateTransition('addressFundsTransfer', {
      inputs,
      feeStrategy,
      userFeeIncrease: 0,
      inputWitness: [],
      outputs,
    })

    const signable = unsignedSt.getSignableBytes()
    const witnesses = await this.signAddressInputs(signable, [source], seed, network)

    const transition = AddressFundsTransferTransitionWASM.fromStateTransition(unsignedSt)
    transition.inputWitness = witnesses
    const signedSt = transition.toStateTransition()

    await this.platformSDK(network).stateTransitions.broadcast(signedSt)
    await this.platformSDK(network).stateTransitions.waitForStateTransitionResult(signedSt)

    return {
      stHash: signedSt.hash(false),
      amountCredits: amountCredits.toString(),
      feeCredits: TRANSFER_FEE_CREDITS.toString(),
      fromAddress: source.platformAddress,
      toAddress: toPlatformAddress,
    }
  }

  async sendIdentityCreditsToAddresses(
    walletId: string,
    identityIdentifier: string,
    recipients: Array<{address: string; amountCredits: bigint}>,
    password: string,
  ): Promise<PlatformSendResult> {
    if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
      throw new Error(`Recipient count must be between 1 and ${MAX_RECIPIENTS}`)
    }
    for (const recipient of recipients) {
      if (recipient.amountCredits < MIN_OUTPUT_CREDITS) {
        throw new Error(`Minimum amount per recipient is ${MIN_OUTPUT_CREDITS.toString()} credits`)
      }
    }

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network

    const identities = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const identity = identities.find(entry => entry.identifier === identityIdentifier)
    if (identity == null) {
      throw new Error('Identity not found in this wallet')
    }

    const totalCredits = recipients.reduce((sum, recipient) => sum + recipient.amountCredits, 0n)
    const feeCredits = identityTransferFeeCredits(recipients.length)

    const balance = await this.platformSDK(network).identities.getIdentityBalance(identityIdentifier)
    if (balance < totalCredits + feeCredits) {
      throw new Error('Identity has insufficient credits for this transfer plus fee')
    }

    const hdKey = this.platformSDK(network).keyPair.seedToHdKey(seed, network)
    const {privateKey, publicKey} = await this.resolveIdentitySigningKey(identity, hdKey, network)

    const nonce = await this.platformSDK(network).identities.getIdentityNonce(identityIdentifier) + 1n

    const unsignedSt = this.platformSDK(network).platformAddresses.createStateTransition('identityCreditTransferToAddresses', {
      identityId: identityIdentifier,
      recipients: recipients.map(recipient => new OutputAddressWASM(recipient.address, recipient.amountCredits)),
      nonce,
      userFeeIncrease: 0,
    })

    const signature = unsignedSt.sign(privateKey, publicKey)
    if (unsignedSt.signature == null || unsignedSt.signature.length === 0) {
      unsignedSt.signature = signature
      unsignedSt.signaturePublicKeyId = publicKey.keyId
    }

    await this.platformSDK(network).stateTransitions.broadcast(unsignedSt)
    await this.platformSDK(network).stateTransitions.waitForStateTransitionResult(unsignedSt)

    return {
      stHash: unsignedSt.hash(false),
      amountCredits: totalCredits.toString(),
      feeCredits: feeCredits.toString(),
      fromAddress: identityIdentifier,
      toAddress: recipients[0].address,
    }
  }

  async transferIdentityCredits(
    walletId: string,
    fromIdentityIdentifier: string,
    toIdentityIdentifier: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Transfer amount must be greater than zero')
    }
    if (toIdentityIdentifier === fromIdentityIdentifier) {
      throw new Error('Recipient identity must be different from the source identity')
    }

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network

    const identities = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const identity = identities.find(entry => entry.identifier === fromIdentityIdentifier)
    if (identity == null) {
      throw new Error('Identity not found in this wallet')
    }

    const balance = await this.platformSDK(network).identities.getIdentityBalance(fromIdentityIdentifier)
    if (balance < amountCredits + IDENTITY_CREDIT_TRANSFER_FEE_CREDITS) {
      throw new Error('Identity has insufficient credits for this transfer plus fee')
    }

    const hdKey = this.platformSDK(network).keyPair.seedToHdKey(seed, network)
    const {privateKey, publicKey} = await this.resolveIdentitySigningKey(identity, hdKey, network)

    const identityNonce = await this.platformSDK(network).identities.getIdentityNonce(fromIdentityIdentifier) + 1n

    const unsignedSt = this.platformSDK(network).identities.createStateTransition('creditTransfer', {
      identityId: fromIdentityIdentifier,
      recipientId: toIdentityIdentifier,
      amount: amountCredits,
      identityNonce,
    })

    const signature = unsignedSt.sign(privateKey, publicKey)
    if (unsignedSt.signature == null || unsignedSt.signature.length === 0) {
      unsignedSt.signature = signature
      unsignedSt.signaturePublicKeyId = publicKey.keyId
    }

    await this.platformSDK(network).stateTransitions.broadcast(unsignedSt)
    await this.platformSDK(network).stateTransitions.waitForStateTransitionResult(unsignedSt)

    return {
      stHash: unsignedSt.hash(false),
      amountCredits: amountCredits.toString(),
      feeCredits: IDENTITY_CREDIT_TRANSFER_FEE_CREDITS.toString(),
      fromAddress: fromIdentityIdentifier,
      toAddress: toIdentityIdentifier,
    }
  }

  async createIdentityFromAddresses(
    walletId: string,
    fromPlatformAddress: string | null,
    amountCredits: bigint,
    password: string,
  ): Promise<IdentityCreateResult> {
    if (amountCredits < MIN_OUTPUT_CREDITS) {
      throw new Error(`Minimum identity funding is ${MIN_OUTPUT_CREDITS.toString()} credits`)
    }

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    const existing = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const identityIndex = existing.reduce((max, identity) => Math.max(max, identity.identityIndex), -1) + 1

    const hdKey = this.platformSDK(network).keyPair.seedToHdKey(seed, network)

    const keySpecs: Array<{purpose: 'AUTHENTICATION' | 'TRANSFER'; securityLevel: 'MASTER' | 'HIGH' | 'CRITICAL'}> = [
      {purpose: 'AUTHENTICATION', securityLevel: 'MASTER'},
      {purpose: 'AUTHENTICATION', securityLevel: 'HIGH'},
      {purpose: 'AUTHENTICATION', securityLevel: 'CRITICAL'},
      {purpose: 'TRANSFER', securityLevel: 'CRITICAL'},
    ]

    const identityKeys = keySpecs.map((spec, keyIndex) => {
      const child = this.platformSDK(network).keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, keyIndex, network)
      if (!child.privateKey || !child.publicKey) {
        throw new Error(`Failed to derive identity key at index ${keyIndex}`)
      }
      return {
        keyId: keyIndex,
        spec,
        privateKey: PrivateKeyWASM.fromBytes(child.privateKey as Uint8Array, network),
        publicKey: child.publicKey as Uint8Array,
      }
    })

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)
    const plan = selectPlatformInputsWithFee(
      candidates,
      amountCredits,
      () => identityCreateFeeCredits(keySpecs.length),
      fromPlatformAddress ?? undefined,
    )

    const inputs = plan.inputs.map(({candidate, credits}) =>
      new InputAddressWASM(candidate.platformAddress, candidate.nonce + 1, credits))
    const feeStrategy = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

    const publicKeysInCreation = identityKeys.map(key =>
      new IdentityPublicKeyInCreationWASM(key.keyId, key.spec.purpose, key.spec.securityLevel, 'ECDSA_SECP256K1', false, key.publicKey))

    const unsignedSt = this.platformSDK(network).platformAddresses.createStateTransition('identityCreateFromAddresses', {
      publicKeys: publicKeysInCreation,
      inputs,
      feeStrategy,
      inputWitness: [],
      userFeeIncrease: 0,
    })

    const signable = unsignedSt.getSignableBytes()

    const signedKeys = identityKeys.map(key =>
      new IdentityPublicKeyInCreationWASM(key.keyId, key.spec.purpose, key.spec.securityLevel, 'ECDSA_SECP256K1', false, key.publicKey, key.privateKey.sign(signable)))
    const witnesses = await this.signAddressInputs(signable, plan.inputs.map(input => input.candidate), seed, network)

    const transition = IdentityCreateFromAddressesTransitionWASM.fromStateTransition(unsignedSt)
    transition.publicKeys = signedKeys
    transition.inputWitness = witnesses
    const signedSt = transition.toStateTransition()

    await this.platformSDK(network).stateTransitions.broadcast(signedSt)
    await this.platformSDK(network).stateTransitions.waitForStateTransitionResult(signedSt)

    const masterKeyHash = identityKeys[0].privateKey.getPublicKeyHash()
    let identifier: string | null = null
    try {
      const identity = await this.platformSDK(network).identities.getIdentityByPublicKeyHash(masterKeyHash)
      identifier = identity.id.base58()
    } catch {
      try {
        const identity = await this.platformSDK(network).identities.getIdentityByNonUniquePublicKeyHash(masterKeyHash)
        identifier = identity.id.base58()
      } catch {
        throw new Error('Identity was broadcast but could not be resolved yet — re-open the wallet to pick it up')
      }
    }

    await this.identityDAO.insertIdentities([{
      walletId,
      identityIndex,
      derivationPath: `m/9'/${COIN_TYPE[network]}'/0'/0/${identityIndex}`,
      identifier,
    }])

    return {
      identifier,
      identityIndex,
      stHash: signedSt.hash(false),
      amountCredits: amountCredits.toString(),
      feeCredits: plan.feeCredits.toString(),
      fromAddress: plan.inputs[0].candidate.platformAddress,
    }
  }

  async topUpIdentityFromAddresses(
    walletId: string,
    identityId: string,
    fromPlatformAddress: string | null,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Top-up amount must be greater than zero')
    }

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    try {
      await this.platformSDK(network).identities.getIdentityByIdentifier(identityId)
    } catch {
      throw new Error('Identity not found on Platform')
    }

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)
    const plan = selectPlatformInputsWithFee(candidates, amountCredits, topUpFeeCredits, fromPlatformAddress ?? undefined)

    const inputs = plan.inputs.map(({candidate, credits}) =>
      new InputAddressWASM(candidate.platformAddress, candidate.nonce + 1, credits))
    const feeStrategy = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

    const unsignedSt = this.platformSDK(network).platformAddresses.createStateTransition('identityTopUpFromAddresses', {
      identityId,
      inputs,
      feeStrategy,
      inputWitness: [],
      userFeeIncrease: 0,
    })

    const signable = unsignedSt.getSignableBytes()
    const witnesses = await this.signAddressInputs(signable, plan.inputs.map(input => input.candidate), seed, network)

    const transition = IdentityTopUpFromAddressesTransitionWASM.fromStateTransition(unsignedSt)
    transition.inputWitness = witnesses
    const signedSt = transition.toStateTransition()

    await this.platformSDK(network).stateTransitions.broadcast(signedSt)
    await this.platformSDK(network).stateTransitions.waitForStateTransitionResult(signedSt)

    return {
      stHash: signedSt.hash(false),
      amountCredits: amountCredits.toString(),
      feeCredits: plan.feeCredits.toString(),
      fromAddress: plan.inputs[0].candidate.platformAddress,
      toAddress: identityId,
    }
  }

  async withdrawPlatformToCore(
    walletId: string,
    fromPlatformAddress: string | null,
    toCoreAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Withdrawal amount must be greater than zero')
    }

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    const outputScript = coreAddressToScript(toCoreAddress, network)

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)
    const plan = selectPlatformInputsWithFee(
      candidates,
      amountCredits,
      () => WITHDRAWAL_FEE_CREDITS,
      fromPlatformAddress ?? undefined,
    )

    const inputs = plan.inputs.map(({candidate, credits}) =>
      new InputAddressWASM(candidate.platformAddress, candidate.nonce + 1, credits))
    const feeStrategy = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

    const unsignedSt = this.platformSDK(network).platformAddresses.createStateTransition('addressCreditWithdrawal', {
      inputs,
      feeStrategy,
      inputWitness: [],
      userFeeIncrease: 0,
      coreFeePerByte: CORE_FEE_PER_BYTE,
      pooling: 'Never',
      outputScript,
    })

    const signable = unsignedSt.getSignableBytes()
    const witnesses = await this.signAddressInputs(signable, plan.inputs.map(input => input.candidate), seed, network)

    const transition = AddressCreditWithdrawalTransitionWASM.fromStateTransition(unsignedSt)
    transition.inputWitness = witnesses
    const signedSt = transition.toStateTransition()

    await this.platformSDK(network).stateTransitions.broadcast(signedSt)
    await this.platformSDK(network).stateTransitions.waitForStateTransitionResult(signedSt)

    return {
      stHash: signedSt.hash(false),
      amountCredits: amountCredits.toString(),
      feeCredits: plan.feeCredits.toString(),
      fromAddress: plan.inputs[0].candidate.platformAddress,
      toAddress: toCoreAddress,
    }
  }

  async withdrawIdentityToCore(
    walletId: string,
    identityIdentifier: string,
    toCoreAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Withdrawal amount must be greater than zero')
    }

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network

    const outputScript = coreAddressToScript(toCoreAddress, network)

    const identities = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const identity = identities.find(entry => entry.identifier === identityIdentifier)
    if (identity == null) {
      throw new Error('Identity not found in this wallet')
    }

    const balance = await this.platformSDK(network).identities.getIdentityBalance(identityIdentifier)
    if (balance < amountCredits + WITHDRAWAL_FEE_CREDITS) {
      throw new Error('Identity has insufficient credits for this withdrawal plus fee')
    }

    const hdKey = this.platformSDK(network).keyPair.seedToHdKey(seed, network)
    const {privateKey, publicKey} = await this.resolveIdentitySigningKey(identity, hdKey, network)

    const identityNonce = await this.platformSDK(network).identities.getIdentityNonce(identityIdentifier) + 1n

    const unsignedSt = this.platformSDK(network).identities.createStateTransition('withdrawal', {
      identityId: identityIdentifier,
      amount: amountCredits,
      coreFeePerByte: CORE_FEE_PER_BYTE,
      pooling: 'Never',
      identityNonce,
      outputScript,
    })

    const signature = unsignedSt.sign(privateKey, publicKey)
    if (unsignedSt.signature == null || unsignedSt.signature.length === 0) {
      unsignedSt.signature = signature
      unsignedSt.signaturePublicKeyId = publicKey.keyId
    }

    await this.platformSDK(network).stateTransitions.broadcast(unsignedSt)
    await this.platformSDK(network).stateTransitions.waitForStateTransitionResult(unsignedSt)

    return {
      stHash: unsignedSt.hash(false),
      amountCredits: amountCredits.toString(),
      feeCredits: WITHDRAWAL_FEE_CREDITS.toString(),
      fromAddress: identityIdentifier,
      toAddress: toCoreAddress,
    }
  }

  async shieldToPool(
    walletId: string,
    fromPlatformAddress: string,
    toShieldedAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<ShieldResult> {
    if (amountCredits <= 0n) {
      throw new Error('Shield amount must be greater than zero')
    }
    if (toShieldedAddress.length === 0) {
      throw new Error('Shielded recipient address is required')
    }

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)

    const source = selectPlatformSource(candidates, amountCredits, fromPlatformAddress || undefined)

    const stHash = await this.shieldedService.shield(network, seed, {
      platformAddress: source.platformAddress,
      nonce: source.nonce,
      balanceCredits: source.balanceCredits.toString(),
      index: source.index,
    }, toShieldedAddress, amountCredits)

    return {
      stHash,
      amountCredits: amountCredits.toString(),
      fromAddress: source.platformAddress,
    }
  }

  private async requireWallet(walletId: string): Promise<Wallet> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    return wallet
  }

  // Decrypts the mnemonic, derives the seed, and backfills the persisted
  // DIP-17 account xpub for wallets created before the column existed.
  private async unlock(walletId: string, password: string): Promise<{wallet: Wallet; seed: Uint8Array; xpub: string}> {
    const wallet = await this.requireWallet(walletId)

    let mnemonic: string
    try {
      mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    const seed = this.platformSDK(wallet.network).keyPair.mnemonicToSeed(mnemonic)

    let xpub = wallet.platformXpub
    if (xpub == null) {
      xpub = await this.platformSDK(wallet.network).keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
      await this.walletDAO.setPlatformXpub(walletId, xpub)
    }

    return {wallet, seed, xpub}
  }

  private async extendPlatformWindow(walletId: string, xpub: string, network: Network): Promise<void> {
    const stored = await this.walletDAO.getPlatformAddressCount(walletId)
    const windowEnd = Math.max(PLATFORM_ADDRESS_LOOKAHEAD, stored)
    let probeStart = windowEnd
    let lastUsed = -1

    for (let batch = 0; batch < MAX_DISCOVERY_BATCHES; batch++) {
      const addresses: string[] = []
      for (let index = probeStart; index < probeStart + PLATFORM_ADDRESS_LOOKAHEAD; index++) {
        addresses.push(this.platformSDK(network).keyPair.derivePlatformAddressFromXpub(xpub, network, index).toBech32m(network))
      }
      const infos = await this.fetchPlatformAddressInfos(addresses, network)

      let usedInBatch = -1
      addresses.forEach((address, i) => {
        const info = infos.get(address)
        if (info != null && (info.balance > 0n || info.nonce > 0)) {
          usedInBatch = probeStart + i
        }
      })
      if (usedInBatch === -1) break

      lastUsed = usedInBatch
      probeStart += PLATFORM_ADDRESS_LOOKAHEAD
    }

    if (lastUsed >= windowEnd) {
      await this.walletDAO.setPlatformAddressCount(walletId, lastUsed + 1)
    }
  }

  private async loadPlatformCandidates(walletId: string, xpub: string, network: Network): Promise<PlatformSourceCandidate[]> {
    const count = Math.max(PLATFORM_ADDRESS_LOOKAHEAD, await this.walletDAO.getPlatformAddressCount(walletId))
    const owned: Array<{platformAddress: string; index: number}> = []
    for (let index = 0; index < count; index++) {
      const address = this.platformSDK(network).keyPair.derivePlatformAddressFromXpub(xpub, network, index)
      owned.push({platformAddress: address.toBech32m(network), index})
    }

    const infoByPlatformAddress = await this.fetchPlatformAddressInfos(
      owned.map(entry => entry.platformAddress),
      network,
    )
    return owned.map(entry => {
      const info = infoByPlatformAddress.get(entry.platformAddress)
      return {
        ...entry,
        balanceCredits: info?.balance ?? 0n,
        nonce: info?.nonce ?? 0,
      }
    })
  }

  private async fetchPlatformAddressInfos(platformAddresses: string[], network: Network): Promise<Map<string, { balance: bigint; nonce: number }>> {
    const result = new Map<string, { balance: bigint; nonce: number }>()

    if (platformAddresses.length === 0) {
      return result
    }

    try {
      const infos = await this.platformSDK(network).platformAddresses.getAddressesInfos(platformAddresses)
      for (const info of infos) {
        result.set(info.address.toBech32m(network), { balance: info.balance, nonce: info.nonce })
      }
      return result
    } catch {
      const settled = await Promise.allSettled(
        platformAddresses.map(address => this.platformSDK(network).platformAddresses.getAddressInfo(address))
      )
      settled.forEach((outcome, i) => {
        if (outcome.status === 'fulfilled') {
          result.set(platformAddresses[i], { balance: outcome.value.balance, nonce: outcome.value.nonce })
        }
      })
      return result
    }
  }

  private async signAddressInputs(
    signable: Uint8Array,
    sources: Array<{index: number; platformAddress: string}>,
    seed: Uint8Array,
    network: Network,
  ): Promise<AddressWitnessWASM[]> {
    const witnesses: AddressWitnessWASM[] = []
    for (const source of sources) {
      const privateKey = await this.platformSDK(network).keyPair.derivePlatformAddressPrivateKey(seed, network, PLATFORM_ACCOUNT, source.index)
      witnesses.push(AddressWitnessWASM.P2PKH(privateKey.sign(signable)))
    }
    return witnesses
  }

  private async resolveIdentitySigningKey(
    identity: Identity,
    hdKey: ReturnType<DashPlatformSDK['keyPair']['seedToHdKey']>,
    network: Network,
  ): Promise<{privateKey: PrivateKeyWASM; publicKey: IdentityPublicKeyWASM}> {
    const identityKeys = await this.platformSDK(network).identities.getIdentityPublicKeys(identity.identifier)

    const derivedKeys: Array<{keyIndex: number; privateKey: PrivateKeyWASM}> = []
    const derivedHashes: DerivedKeyHash[] = []
    for (let keyIndex = 0; keyIndex < IDENTITY_KEY_LOOKAHEAD; keyIndex++) {
      const child = this.platformSDK(network).keyPair.deriveIdentityPrivateKey(hdKey, identity.identityIndex, keyIndex, network)
      if (!child.privateKey) continue
      const privateKey = PrivateKeyWASM.fromBytes(child.privateKey as Uint8Array, network)
      derivedKeys.push({keyIndex, privateKey})
      derivedHashes.push({keyIndex, publicKeyHashHex: privateKey.getPublicKeyHash()})
    }

    const match = matchIdentityKey(
      identityKeys.map(key => ({
        keyId: key.keyId,
        purpose: key.purpose,
        publicKeyHashHex: key.getPublicKeyHash(),
      })),
      derivedHashes,
    )
    if (match == null) {
      throw new Error('This identity has no transfer key this wallet can sign with')
    }

    const derived = derivedKeys.find(entry => entry.keyIndex === match.keyIndex)
    const publicKey = identityKeys.find(key => key.keyId === match.keyId)
    if (derived == null || publicKey == null) {
      throw new Error('This identity has no transfer key this wallet can sign with')
    }

    return {privateKey: derived.privateKey, publicKey}
  }
}
