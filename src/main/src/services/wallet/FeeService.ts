import {AddressDAO} from '../../database/AddressDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {PlatformAddressService} from '../platform/PlatformAddressService'
import {PlatformWorkerService} from '../platform/PlatformWorkerService'
import {ShieldedService} from '../platform/ShieldedService'
import {Preferences} from '../../preferences'
import {Wallet} from '../../types/Wallet'
import {GroupedAddresses} from '../../types/GroupedAddresses'
import {OperationFee} from '../../types/Fee'
import {PlatformInputOutcome} from '../../types/PlatformTransfer'
import {TransferInputSelection} from '../../types/CoreTransaction'
import {PreviewParams, TransactionPreview} from '../../types/TransactionPreview'
import {UTXO} from '../../types/UTXO'
import {
  FeeOperation,
  FeeParams,
  SelectionFeeOperation,
  TransitionFeeOperation,
} from '../../../platform/types/messages'
import {ASSET_LOCK_PAYLOAD_BYTES} from '../../constants/chain'
import {CREDITS_PER_DUFF} from '../../constants/credits'
import {requireWallet} from '../../utils/requireWallet'
import {maxSelectableAmount, requireAutomaticSelection, selectCoins} from '../../utils/coinSelection'
import {
  PlatformFeeForInputs,
  maxPlatformCredits,
  requireAutomaticInputs,
  requireRecipients,
  selectPlatformInputsWithFee,
  selectPlatformSource,
  selectablePlatformInputs,
} from '../../utils/platformTransfer'
import {coreFeeDuffsFor, coreFeePerByte} from '../../utils/coreFeeRate'
import {lockedDuffsFor} from '../../utils/assetLockTx'
import {
  pickCreditChangeAddress,
  requireCoreRecipients,
  selectTransferInputs,
  selectableTransferUtxos,
} from '../../utils/transferInputs'
import {
  coreChangeAndFee,
  coreInputEntries,
  coreRecipients,
  platformInputEntries,
  platformRecipients,
  previewEntry,
  previewFeeParams,
  previewTotal,
  recipientEntries,
  reducedRecipientEntries,
  shieldedChangeEntries,
  shieldedInputEntries,
} from '../../utils/transactionPreview'

// Every fee a quote can be asked for, L1 and L2, is answered here, and every
// preview of the transaction that would pay it: a price and the selection it
// was quoted over are one answer, and reporting them apart is what would let
// them drift.
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
      case 'coreSend': {
        requireAutomaticInputs(params.platformSource)
        const outputsCount = Array.isArray(params.recipient) ? Math.max(params.recipient.length, 1) : 1
        return {feeCredits: null, ...await this.coreQuote(wallet, params, outputsCount, 0), maxPerTx: null, noteLimit: null}
      }

      // Two transactions, so two fees. The L1 lock is paid in Dash on top of the
      // amount; the transition its proof funds is paid in credits out of what
      // the lock created, so it never reaches the quote as one number.
      case 'assetLockFunding':
      case 'assetLockShield':
      case 'identityRegister':
      case 'identityTopUpL1':
        requireAutomaticInputs(params.platformSource)
        return {
          feeCredits: await this.protocolFee(wallet, operation, params, 1),
          // A lock pays its burn output whatever the recipient list names.
          ...await this.coreQuote(wallet, params, 1, ASSET_LOCK_PAYLOAD_BYTES),
          maxPerTx: null,
          noteLimit: null,
        }

      // Priced by the pool, which carves the fee to the credit.
      case 'shieldedTransfer':
      case 'unshield':
      case 'shieldedWithdrawal':
      case 'identityCreateFromShielded': {
        requireAutomaticSelection(params.coreSource)
        requireAutomaticInputs(params.platformSource)
        const outputCount = Array.isArray(params.recipient) ? Math.max(params.recipient.length, 1) : 1
        return this.shielded.estimateSpendFee(
          walletId, operation, params.amountCredits, params.shieldedSource ?? null, outputCount)
      }

      // Funded by platform addresses: the fee scales with the inputs, so the
      // selection has to run before the price is known.
      case 'addressFundsTransfer':
      case 'addressWithdrawal':
      case 'identityCreate':
      case 'identityTopUp':
        requireAutomaticSelection(params.coreSource)
        return this.platformQuote(wallet, operation, params)

      // Spends an identity's balance, so there is no price until one is picked.
      // null rather than zero: nothing charges zero.
      case 'identityToAddress':
      case 'identityToIdentity':
      case 'identityWithdrawal':
        requireAutomaticSelection(params.coreSource)
        requireAutomaticInputs(params.platformSource)
        return this.credits(params.identityId == null || params.amountCredits <= 0n
          ? null
          : await this.protocolFee(wallet, operation, params, 1))

      // One input by construction: a shield spends its source address whole.
      case 'shield':
        requireAutomaticSelection(params.coreSource)
        requireAutomaticInputs(params.platformSource)
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

  // What the send would spend and pay, run one step short of signing: the same
  // six groups estimateFee prices, reporting the selection each one runs rather
  // than only what it costs.
  //
  // No password on any route: nothing is signed here, and every selection reads
  // a persisted xpub, an address balance or our own note flags. A refusal is the
  // send's own — an amount the coins cannot fund has no transaction to preview.
  async previewTransaction(
    walletId: string,
    operation: FeeOperation,
    params: PreviewParams,
  ): Promise<TransactionPreview> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const feeParams = previewFeeParams(params)

    switch (operation) {
      case 'coreSend': {
        requireAutomaticInputs(params.platformSource)
        const amountDuffs = requireCoreRecipients(coreRecipients(params.recipients))
        const {selection, utxos} = await this.corePlan(wallet, params, amountDuffs, params.recipients.length, 0)
        const {change, feeDuffs} = coreChangeAndFee(
          selection.changeAddress, selection.inputTotal - amountDuffs - selection.feeDuffs, selection.feeDuffs)

        return {
          inputs: coreInputEntries(selection.transferInputs, utxos),
          outputs: [...recipientEntries(params.recipients, 'duffs'), ...change],
          feeDuffs,
          feeCredits: null,
        }
      }

      // Two transactions: the lock carries the L2 fee on top of the amount, so
      // what it locks is more than what arrives, and the credit output is the
      // coin whose key signs the proof the L2 half spends.
      case 'assetLockFunding':
      case 'assetLockShield':
      case 'identityRegister':
      case 'identityTopUpL1': {
        requireAutomaticInputs(params.platformSource)
        const amountDuffs = previewTotal(params.recipients)
        // The credits the lock will create, which is what the funding prices
        // itself against — an L1 form carries no amount in credits.
        const arriving = {...feeParams, amountCredits: amountDuffs * CREDITS_PER_DUFF}
        const feeCredits = await this.protocolFee(wallet, operation, arriving, 1)
        const lockDuffs = lockedDuffsFor(amountDuffs, feeCredits)
        const {selection, utxos, grouped} =
          await this.corePlan(wallet, params, lockDuffs, 1, ASSET_LOCK_PAYLOAD_BYTES)
        const {change, feeDuffs} = coreChangeAndFee(
          selection.changeAddress, selection.inputTotal - lockDuffs - selection.feeDuffs, selection.feeDuffs)

        return {
          inputs: coreInputEntries(selection.transferInputs, utxos),
          outputs: [
            ...recipientEntries(params.recipients, 'duffs'),
            previewEntry('credit', pickCreditChangeAddress(grouped, selection.changeAddress).address, lockDuffs, 'duffs'),
            ...change,
          ],
          feeDuffs,
          feeCredits,
        }
      }

      case 'shieldedTransfer':
      case 'unshield':
      case 'shieldedWithdrawal':
      case 'identityCreateFromShielded': {
        requireAutomaticSelection(params.coreSource)
        requireAutomaticInputs(params.platformSource)
        const plan = await this.shielded.planSpend(
          walletId, operation, params.amountCredits, params.shieldedSource ?? null, Math.max(params.recipients.length, 1))

        // A create is funded by the denomination itself: the fee comes out of
        // what the identity is left with, rather than out of the pool beside it.
        const creates = operation === 'identityCreateFromShielded'
        return {
          inputs: shieldedInputEntries(plan),
          outputs: [
            ...(creates
              ? [previewEntry('recipient', '', params.amountCredits - plan.feeCredits, 'credits')]
              : recipientEntries(params.recipients, 'credits')),
            ...shieldedChangeEntries(
              plan.totalCredits - params.amountCredits - (creates ? 0n : plan.feeCredits)),
          ],
          feeDuffs: null,
          feeCredits: plan.feeCredits,
        }
      }

      // Credits are divisible, so what an input does not draw stays on its
      // address: these have no change output to come back to.
      case 'addressFundsTransfer':
      case 'addressWithdrawal':
      case 'identityCreate':
      case 'identityTopUp': {
        requireAutomaticSelection(params.coreSource)
        // The one address-funded transition that fans out, and so the only one
        // whose recipient list its send validates.
        if (operation === 'addressFundsTransfer') requireRecipients(platformRecipients(params.recipients))
        const {plan, error} = await this.planInputs(wallet, operation, feeParams)
        if (plan === null) throw new Error(error)

        return {
          inputs: platformInputEntries(plan),
          outputs: reducedRecipientEntries(params.recipients, plan.feeCredits, plan.feeStrategy),
          feeDuffs: null,
          feeCredits: plan.feeCredits,
        }
      }

      case 'identityToAddress':
      case 'identityToIdentity':
      case 'identityWithdrawal': {
        requireAutomaticSelection(params.coreSource)
        requireAutomaticInputs(params.platformSource)
        if (params.identityId == null || params.identityId.length === 0) {
          throw new Error(`${operation} needs the identity that funds it`)
        }
        const feeCredits = await this.protocolFee(wallet, operation, feeParams, 1)

        return {
          inputs: [previewEntry('input', params.identityId, previewTotal(params.recipients) + feeCredits, 'credits')],
          outputs: recipientEntries(params.recipients, 'credits'),
          feeDuffs: null,
          feeCredits,
        }
      }

      case 'shield': {
        requireAutomaticSelection(params.coreSource)
        requireAutomaticInputs(params.platformSource)
        const feeCredits = await this.protocolFee(wallet, operation, feeParams, 1)
        const source = selectPlatformSource(
          await this.addresses.loadCandidates(wallet),
          params.amountCredits,
          feeCredits,
          params.fromAddress ?? undefined,
        )

        return {
          inputs: [previewEntry('input', source.platformAddress, params.amountCredits + feeCredits, 'credits')],
          outputs: recipientEntries(params.recipients, 'credits'),
          feeDuffs: null,
          feeCredits,
        }
      }
    }
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
      selectablePlatformInputs(candidates, params.platformSource),
      params.amountCredits,
      this.inputFee(wallet, operation, params),
      params.platformSource,
      this.outputCount(operation, params),
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
  // refuses still answers, with the floor a single input would cost.
  private async platformQuote(
    wallet: Wallet,
    operation: SelectionFeeOperation,
    params: FeeParams,
  ): Promise<OperationFee> {
    const candidates = await this.addresses.loadCandidates(wallet)
    const selectable = selectablePlatformInputs(candidates, params.platformSource)
    const feeForInputs = this.inputFee(wallet, operation, params)
    const {plan} = await selectPlatformInputsWithFee(
      selectable, params.amountCredits, feeForInputs, params.platformSource, this.outputCount(operation, params))

    return {
      feeCredits: plan?.feeCredits ?? await feeForInputs(1),
      feeDuffs: null,
      maxDuffs: null,
      maxPerTx: await maxPlatformCredits(selectable, feeForInputs, params.platformSource),
      noteLimit: null,
    }
  }

  // A transfer is the one address-funded transition carrying outputs of its
  // own, which are all a reduceOutput fee step could index.
  private outputCount(operation: SelectionFeeOperation, params: FeeParams): number {
    if (operation !== 'addressFundsTransfer') return 0
    return Array.isArray(params.recipient) ? params.recipient.length : 1
  }

  // Every input count is a worker round trip, and the selection and the maximum
  // walk the same ones, so a quote prices a count once.
  private inputFee(wallet: Wallet, operation: SelectionFeeOperation, params: FeeParams): PlatformFeeForInputs {
    const priced = new Map<number, Promise<bigint>>()
    return inputCount => {
      const quoted = priced.get(inputCount) ?? this.protocolFee(wallet, operation, params, inputCount)
      priced.set(inputCount, quoted)
      return quoted
    }
  }

  // selectTransferInputs is what the send itself calls, over the same coins at
  // the same rate, so a preview cannot pick a set the send would not. It is
  // also where an amount the wallet cannot fund refuses.
  private async corePlan(
    wallet: Wallet,
    params: PreviewParams,
    amountDuffs: bigint,
    outputsCount: number,
    payloadBytes: number,
  ): Promise<{selection: TransferInputSelection; utxos: UTXO[]; grouped: GroupedAddresses}> {
    const {coreFeeMultiplier} = this.preferences.general
    const grouped = await this.addressDAO.getAddressesByWalletId(wallet.walletId)
    const provider = this.providers.forWallet(wallet.walletId, wallet.network)
    await provider.ensureReady()
    const utxos = await provider.getWalletUtxos()

    const selection = selectTransferInputs(
      grouped,
      utxos,
      amountDuffs,
      inputsCount => coreFeeDuffsFor(coreFeeMultiplier, inputsCount, outputsCount, true, payloadBytes),
      params.coreSource ?? undefined,
      params.changeTo ?? undefined,
    )
    return {selection, utxos, grouped}
  }

  // The fee scales with the inputs the selection takes, so the quote runs that
  // selection over the same coins the send will. maxDuffs is what those coins
  // can fund at their own price, which is the only amount a Max can offer
  // without the send refusing it.
  private async coreQuote(wallet: Wallet, params: FeeParams, outputsCount: number, payloadBytes: number): Promise<{feeDuffs: bigint; maxDuffs: bigint}> {
    const feeForInputs = (inputsCount: number): bigint =>
      coreFeeDuffsFor(this.preferences.general.coreFeeMultiplier, inputsCount, outputsCount, true, payloadBytes)

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
