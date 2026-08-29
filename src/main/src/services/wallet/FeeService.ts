import {AddressDAO} from '../../database/AddressDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {PlatformAddressService} from '../platform/PlatformAddressService'
import {PlatformWorkerService} from '../platform/PlatformWorkerService'
import {ShieldedService} from '../platform/ShieldedService'
import {Preferences} from '../../preferences'
import {Wallet} from '../../types/Wallet'
import {OperationFee} from '../../types/Fee'
import {PlatformInputOutcome} from '../../types/PlatformTransfer'
import {
  FeeOperation,
  FeeParams,
  SelectionFeeOperation,
  TransitionFeeOperation,
} from '../../../platform/types/messages'
import {ASSET_LOCK_PAYLOAD_BYTES} from '../../constants/chain'
import {requireWallet} from '../../utils/requireWallet'
import {maxSelectableAmount, requireAutomaticSelection, selectCoins} from '../../utils/coinSelection'
import {selectPlatformInputsWithFee} from '../../utils/platformTransfer'
import {coreFeeDuffsFor, coreFeePerByte} from '../../utils/coreFeeRate'
import {selectableTransferUtxos} from '../../utils/transferInputs'

// Every fee a quote can be asked for, L1 and L2, is answered here.
//
// It is an aggregate for the same reason WalletService is one: a fee spans core
// sends, platform transitions and shielded spends, and no single service group
// can answer for all three. Funding selection lives here too, because the fee
// for an address-funded transition scales with the inputs the selection takes
// — pricing it and choosing them is one computation, and splitting them is what
// let a quote and its send disagree.
//
// The L1 rate is the one thing that does not route through here: core/ may not
// import platform/, and this service does. It stays a pure function of the
// multiplier in coreFeeRate.ts, called with the preference wherever it is
// charged, so there is still only one place it is computed.
export class FeeService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private addresses: PlatformAddressService
  private platform: PlatformWorkerService
  private shielded: ShieldedService
  private providers: WalletProviderFactory
  private preferences: Preferences

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    addresses: PlatformAddressService,
    platform: PlatformWorkerService,
    shielded: ShieldedService,
    providers: WalletProviderFactory,
    preferences: Preferences,
  ) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.addresses = addresses
    this.platform = platform
    this.shielded = shielded
    this.providers = providers
    this.preferences = preferences
  }

  // The whole fee model, in six groups. Which group an operation is in decides
  // how it is priced; what that price is belongs to the worker, not here.
  async estimateFee(walletId: string, operation: FeeOperation, params: FeeParams): Promise<OperationFee> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    switch (operation) {
      // Paid in Dash on L1, per byte, so the quote runs the selection the send
      // will run rather than a floor the send is free to exceed.
      case 'coreSend':
        return {feeCredits: null, ...await this.coreQuote(wallet, params, 0), maxPerTx: null, noteLimit: null}

      // Two transactions, so two fees. The L1 lock is paid in Dash on top of the
      // amount; the transition its proof funds is paid in credits out of what
      // the lock created, so it never reaches the quote as one number.
      case 'assetLockFunding':
      case 'assetLockShield':
      case 'identityRegister':
      case 'identityTopUpL1':
        return {
          feeCredits: await this.protocolFee(wallet, operation, params, 1),
          ...await this.coreQuote(wallet, params, ASSET_LOCK_PAYLOAD_BYTES),
          maxPerTx: null,
          noteLimit: null,
        }

      // Priced by the pool, which carves the fee to the credit.
      case 'shieldedTransfer':
      case 'unshield':
      case 'shieldedWithdrawal':
      case 'identityCreateFromShielded':
        requireAutomaticSelection(params.coreSource)
        return this.shielded.estimateSpendFee(walletId, operation, params.amountCredits, params.noteIndexes ?? null)

      // Funded by platform addresses: the fee scales with the inputs, so the
      // selection has to run before the price is known.
      case 'addressWithdrawal':
      case 'identityCreate':
      case 'identityTopUp':
        requireAutomaticSelection(params.coreSource)
        return this.credits(await this.selectionFee(wallet, operation, params))

      // Spends an identity's balance, so there is no price until one is picked.
      // null rather than zero: nothing charges zero.
      case 'identityToAddress':
      case 'identityToIdentity':
      case 'identityWithdrawal':
        requireAutomaticSelection(params.coreSource)
        return this.credits(params.identityId == null || params.amountCredits <= 0n
          ? null
          : await this.protocolFee(wallet, operation, params, 1))

      // One input by construction: neither send ever splits its source.
      case 'addressFundsTransfer':
      case 'shield':
        requireAutomaticSelection(params.coreSource)
        return this.credits(await this.protocolFee(wallet, operation, params, 1))
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
    const candidates = await this.addresses.loadCandidates(wallet)
    return selectPlatformInputsWithFee(
      candidates,
      params.amountCredits,
      inputCount => this.protocolFee(wallet, operation, params, inputCount),
      params.sourceAddress ?? undefined,
    )
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
    const rate = coreFeePerByte(this.preferences.general.coreFeeMultiplier)
    const quote = await this.platform.request('transitionFee', wallet.network, {
      operation,
      params: {...params, inputCount, coreFeePerByte: rate},
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

  // The fee scales with the inputs the selection takes, so the quote runs that
  // selection over the same coins the send will. maxDuffs is what those coins
  // can fund at their own price, which is the only amount a Max can offer
  // without the send refusing it.
  private async coreQuote(wallet: Wallet, params: FeeParams, payloadBytes: number): Promise<{feeDuffs: bigint; maxDuffs: bigint}> {
    const feeForInputs = (inputsCount: number): bigint =>
      coreFeeDuffsFor(this.preferences.general.coreFeeMultiplier, inputsCount, 1, true, payloadBytes)

    const source = params.coreSource ?? undefined
    const grouped = await this.addressDAO.getAddressesByWalletId(wallet.walletId)
    const utxos = await this.providers.forWallet(wallet.walletId, wallet.network).getWalletUtxos()
    const selectable = selectableTransferUtxos(grouped, utxos, source)

    const maxDuffs = maxSelectableAmount(selectable, feeForInputs, source)
    const amountDuffs = params.amountDuffs ?? 0n

    // A quote is asked for before the amount is affordable, so one the selection
    // would refuse answers with a floor rather than failing. A picked set has no
    // floor to guess at: its count is the count the send will charge for.
    const floorInputs = source?.kind === 'outpoints' ? Math.max(selectable.length, 1) : 1

    const feeDuffs = amountDuffs > 0n && amountDuffs <= maxDuffs
      ? selectCoins(selectable, amountDuffs, feeForInputs, source).fee
      : feeForInputs(floorInputs)

    return {feeDuffs, maxDuffs}
  }

  private credits(feeCredits: bigint | null): OperationFee {
    return {feeCredits, feeDuffs: null, maxDuffs: null, maxPerTx: null, noteLimit: null}
  }
}
