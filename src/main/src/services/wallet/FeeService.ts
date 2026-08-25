import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {WalletDAO} from '../../database/WalletDAO'
import {PlatformWorkerService} from '../platform/PlatformWorkerService'
import {ShieldedService} from '../platform/ShieldedService'
import {Preferences} from '../../preferences'
import {Network} from '../../types/Network'
import {Wallet} from '../../types/Wallet'
import {FeeOperation, FeeParams, OperationFee, SelectionQuery} from '../../types/Fee'
import {PlatformInputPlan, PlatformSourceCandidate} from '../../types/PlatformTransfer'
import {FeeQuery} from '../../../platform/types/messages'
import {requireWallet} from '../../utils/requireWallet'
import {selectPlatformInputsWithFee} from '../../utils/platformTransfer'
import {coreFeeDuffs, coreFeePerByte} from '../../utils/coreFeeRate'
import {
  CREDIT_FEE_UNPRICED,
  MAX_ADDRESS_INPUTS,
  PLATFORM_ADDRESS_LOOKAHEAD,
  SPEND_KIND_BY_OPERATION,
} from '../../constants'

// Every fee in the wallet, L1 and L2, is decided here and nowhere else.
//
// It is an aggregate for the same reason WalletService is one: a fee spans core
// sends, platform transitions and shielded spends, and no single service group
// can answer for all three. Funding selection lives here too, because the fee
// for an address-funded transition scales with the inputs the selection takes
// — pricing it and choosing them is one computation, and splitting them is what
// let a quote and its send disagree.
export class FeeService {
  private walletDAO: WalletDAO
  private platform: PlatformWorkerService
  private shielded: ShieldedService
  private preferences: Preferences
  private keyPair = new KeyPairController()

  constructor(
    walletDAO: WalletDAO,
    platform: PlatformWorkerService,
    shielded: ShieldedService,
    preferences: Preferences,
  ) {
    this.walletDAO = walletDAO
    this.platform = platform
    this.shielded = shielded
    this.preferences = preferences
  }

  // Every operation the wallet can price, once, next to what gets priced for
  // it. Sends call planInputs and protocolFee from the same arms, so a quote
  // and the transaction it describes cannot drift apart.
  async estimateFee(walletId: string, operation: FeeOperation, params: FeeParams): Promise<OperationFee> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const {network} = wallet
    const {amountCredits, recipient, sourceAddress, identityId, noteIndexes} = params
    const priceable = amountCredits > 0n

    switch (operation) {
      // Paid in Dash: a flat per-transaction rate, whatever the operation.
      case 'coreSend':
      case 'assetLockFunding':
      case 'assetLockShield':
      case 'identityRegister':
      case 'identityTopUpL1':
        return {feeCredits: null, feeDuffs: this.coreFee(), maxPerTx: null, noteLimit: null}

      // One input by construction: sendPlatformTransfer never splits a transfer.
      case 'addressFundsTransfer':
        return this.credits(await this.protocolFee(network, {kind: 'addressTransfer', inputCount: 1}))

      case 'addressWithdrawal':
        return this.credits(await this.selectionFee(wallet, amountCredits, sourceAddress,
          {kind: 'addressWithdrawal'}))

      case 'identityCreate':
        return this.credits(await this.selectionFee(wallet, amountCredits, sourceAddress,
          {kind: 'identityCreateFromAddresses'}))

      case 'identityTopUp':
        return this.credits(await this.selectionFee(wallet, amountCredits, sourceAddress,
          {kind: 'identityTopUpFromAddresses', identityId: recipient}))

      case 'shield':
        return this.credits(await this.protocolFee(network, {kind: 'shield'}))

      case 'identityToAddress':
        return identityId === null || !priceable ? CREDIT_FEE_UNPRICED : this.credits(
          await this.protocolFee(network, {kind: 'identityCreditsToAddresses', identityId,
            recipients: [{address: recipient, amountCredits}]}))

      case 'identityToIdentity':
        return identityId === null || !priceable ? CREDIT_FEE_UNPRICED : this.credits(
          await this.protocolFee(network, {kind: 'identityCreditTransfer', identityId,
            recipientId: recipient, amountCredits}))

      case 'identityWithdrawal':
        return identityId === null || !priceable ? CREDIT_FEE_UNPRICED : this.credits(
          await this.protocolFee(network, {kind: 'identityWithdrawal', identityId, amountCredits,
            coreAddress: recipient, coreFeePerByte: this.coreRate()}))

      case 'shieldedTransfer':
      case 'unshield':
      case 'shieldedWithdrawal':
      case 'identityCreateFromPool':
        return this.shielded.estimateSpendFee(
          walletId, SPEND_KIND_BY_OPERATION[operation], amountCredits, noteIndexes)

      default:
        throw new Error(`Unknown fee operation: ${String(operation)}`)
    }
  }

  // What consensus charges for this transition, plus the user's headroom. The
  // multiplier never touches a shielded fee, which the pool carves to the
  // credit, so only a metered quote is scaled.
  async protocolFee(network: Network, query: FeeQuery): Promise<bigint> {
    const quote = await this.platform.request('transitionFee', network, {query})
    if (!quote.metered) return quote.feeCredits
    return quote.feeCredits * BigInt(this.preferences.general.platformFeeMultiplier)
  }

  // The fee scales with the input count, so the selection and the price resolve
  // together. Sends take the plan; quotes take its fee.
  async planInputs(
    wallet: Wallet,
    amountCredits: bigint,
    sourceAddress: string | null,
    query: SelectionQuery,
  ): Promise<PlatformInputPlan> {
    const candidates = await this.loadCandidates(wallet)
    return selectPlatformInputsWithFee(
      candidates,
      amountCredits,
      inputCount => this.protocolFee(wallet.network, {...query, inputCount}),
      sourceAddress ?? undefined,
    )
  }

  // Every platform address this wallet owns, with the balance and nonce that
  // decide whether it can fund anything.
  async loadCandidates(wallet: Wallet): Promise<PlatformSourceCandidate[]> {
    if (wallet.platformXpub == null) return []

    const stored = await this.walletDAO.getPlatformAddressCount(wallet.walletId)
    const count = Math.max(PLATFORM_ADDRESS_LOOKAHEAD, stored)
    const owned = Array.from({length: count}, (_, index) => {
      const address = this.keyPair.derivePlatformAddressFromXpub(wallet.platformXpub!, wallet.network, index)
      return {platformAddress: address.toBech32m(wallet.network), addressBytes: address.bytes(), index}
    })

    const {infos} = await this.platform.request('addressInfos', wallet.network, {
      addresses: owned.map(entry => entry.platformAddress),
    })

    const byAddress = new Map(infos.map(info => [info.address, info]))
    return owned.map(entry => ({
      ...entry,
      balanceCredits: byAddress.get(entry.platformAddress)?.balance ?? 0n,
      nonce: byAddress.get(entry.platformAddress)?.nonce ?? 0,
    }))
  }

  coreFee(): bigint {
    return coreFeeDuffs(this.preferences.general.coreFeeMultiplier)
  }

  // Consensus rejects a withdrawal whose rate is not a non-zero Fibonacci number.
  coreRate(): number {
    return coreFeePerByte(this.preferences.general.coreFeeMultiplier)
  }

  // A quote is asked for before the amount is affordable, so a selection the
  // balances cannot fund answers with the one-input floor. Only the selection's
  // own refusal is absorbed: a dead worker or a failed lookup must reach the user.
  private async selectionFee(
    wallet: Wallet,
    amountCredits: bigint,
    sourceAddress: string | null,
    query: SelectionQuery,
  ): Promise<bigint> {
    const candidates = await this.loadCandidates(wallet)
    if (!canFund(candidates, amountCredits)) return this.protocolFee(wallet.network, {...query, inputCount: 1})

    const plan = await selectPlatformInputsWithFee(
      candidates,
      amountCredits,
      inputCount => this.protocolFee(wallet.network, {...query, inputCount}),
      sourceAddress ?? undefined,
    ).catch(() => null)

    return plan?.feeCredits ?? this.protocolFee(wallet.network, {...query, inputCount: 1})
  }

  private credits(feeCredits: bigint): OperationFee {
    return {feeCredits, feeDuffs: null, maxPerTx: null, noteLimit: null}
  }
}

// Cheap pre-check so an unaffordable amount never reaches the selection, whose
// refusal would otherwise be indistinguishable from a real failure.
function canFund(candidates: PlatformSourceCandidate[], amountCredits: bigint): boolean {
  const reachable = [...candidates]
    .sort((a, b) => (a.balanceCredits === b.balanceCredits ? 0 : a.balanceCredits > b.balanceCredits ? -1 : 1))
    .slice(0, MAX_ADDRESS_INPUTS)
    .reduce((sum, candidate) => sum + candidate.balanceCredits, 0n)
  return amountCredits > 0n && reachable > amountCredits
}
