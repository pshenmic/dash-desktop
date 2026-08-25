import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {WalletDAO} from '../../database/WalletDAO'
import {PlatformWorkerService} from '../platform/PlatformWorkerService'
import {ShieldedService} from '../platform/ShieldedService'
import {Preferences} from '../../preferences'
import {Wallet} from '../../types/Wallet'
import {OperationFee} from '../../types/Fee'
import {PlatformInputOutcome, PlatformSourceCandidate} from '../../types/PlatformTransfer'
import {
  FeeOperation,
  FeeParams,
  SelectionFeeOperation,
  TransitionFeeOperation,
} from '../../../platform/types/messages'
import {requireWallet} from '../../utils/requireWallet'
import {selectPlatformInputsWithFee} from '../../utils/platformTransfer'
import * as coreFee from '../../utils/coreFeeRate'
import {CREDIT_FEE_UNPRICED, PLATFORM_ADDRESS_LOOKAHEAD} from '../../constants'

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

  // The whole fee model, in six groups. Which group an operation is in decides
  // how it is priced; what that price is belongs to the worker, not here.
  async estimateFee(walletId: string, operation: FeeOperation, params: FeeParams): Promise<OperationFee> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    switch (operation) {
      // Paid in Dash on L1: a flat per-transaction rate.
      case 'coreSend':
        return {feeCredits: null, feeDuffs: this.coreFeeDuffs(), maxPerTx: null, noteLimit: null}

      // Two transactions, so two fees. The L1 lock is paid in Dash on top of the
      // amount; the transition its proof funds is paid in credits out of what
      // the lock created, so it never reaches the quote as one number.
      case 'assetLockFunding':
      case 'assetLockShield':
      case 'identityRegister':
      case 'identityTopUpL1':
        return {
          feeCredits: await this.protocolFee(wallet, operation, params, 1),
          feeDuffs: this.coreFeeDuffs(),
          maxPerTx: null,
          noteLimit: null,
        }

      // Priced by the pool, which carves the fee to the credit.
      case 'shieldedTransfer':
      case 'unshield':
      case 'shieldedWithdrawal':
      case 'identityCreateFromPool':
        return this.shielded.estimateSpendFee(walletId, operation, params.amountCredits, params.noteIndexes)

      // Funded by platform addresses: the fee scales with the inputs, so the
      // selection has to run before the price is known.
      case 'addressWithdrawal':
      case 'identityCreate':
      case 'identityTopUp':
        return this.credits(await this.selectionFee(wallet, operation, params))

      // Spends an identity's balance, so there is no price until one is picked.
      case 'identityToAddress':
      case 'identityToIdentity':
      case 'identityWithdrawal':
        return params.identityId === null || params.amountCredits <= 0n
          ? CREDIT_FEE_UNPRICED
          : this.credits(await this.protocolFee(wallet, operation, params, 1))

      // One input by construction: neither send ever splits its source.
      case 'addressFundsTransfer':
      case 'shield':
        return this.credits(await this.protocolFee(wallet, operation, params, 1))

      default:
        throw new Error(`Unknown fee operation: ${String(operation)}`)
    }
  }

  // A send has everything a quote might still be missing, so an unpriced answer
  // here is a bug rather than a state the caller has to render.
  async requireFee(walletId: string, operation: FeeOperation, params: FeeParams): Promise<bigint> {
    const {feeCredits} = await this.estimateFee(walletId, operation, params)
    if (feeCredits === null) throw new Error(`Could not price ${operation}`)
    return feeCredits
  }

  // The fee scales with the input count, so the selection and the price resolve
  // together. Sends take the plan and report its refusal; quotes take its fee.
  async planInputs(
    wallet: Wallet,
    operation: SelectionFeeOperation,
    params: FeeParams,
  ): Promise<PlatformInputOutcome> {
    const candidates = await this.loadCandidates(wallet)
    return selectPlatformInputsWithFee(
      candidates,
      params.amountCredits,
      inputCount => this.protocolFee(wallet, operation, params, inputCount),
      params.sourceAddress ?? undefined,
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

  coreFeeDuffs(): bigint {
    return coreFee.coreFeeDuffs(this.preferences.general.coreFeeMultiplier)
  }

  // Consensus rejects a withdrawal whose rate is not a non-zero Fibonacci number.
  coreFeePerByte(): number {
    return coreFee.coreFeePerByte(this.preferences.general.coreFeeMultiplier)
  }

  // What consensus charges for this transition, plus the user's headroom. The
  // multiplier never touches a shielded fee, which the pool carves to the
  // credit, so only a metered quote is scaled.
  private async protocolFee(
    wallet: Wallet,
    operation: TransitionFeeOperation,
    params: FeeParams,
    inputCount: number,
  ): Promise<bigint> {
    const quote = await this.platform.request('transitionFee', wallet.network, {
      operation,
      params: {...params, inputCount, coreFeePerByte: this.coreFeePerByte()},
    })
    if (!quote.metered) return quote.feeCredits
    return quote.feeCredits * BigInt(this.preferences.general.platformFeeMultiplier)
  }

  // A quote is asked for before the amount is affordable, so a selection that
  // refuses answers with the one-input floor rather than failing.
  private async selectionFee(
    wallet: Wallet,
    operation: SelectionFeeOperation,
    params: FeeParams,
  ): Promise<bigint> {
    const {plan} = await this.planInputs(wallet, operation, params)
    return plan?.feeCredits ?? this.protocolFee(wallet, operation, params, 1)
  }

  private credits(feeCredits: bigint): OperationFee {
    return {feeCredits, feeDuffs: null, maxPerTx: null, noteLimit: null}
  }
}
