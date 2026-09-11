import {AddressDAO} from '../../database/AddressDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {CoreTransactionService} from '../core/CoreTransactionService'
import {PlatformAddressService} from '../platform/PlatformAddressService'
import {PlatformWorkerService} from '../platform/PlatformWorkerService'
import {ShieldedService} from '../platform/ShieldedService'
import {Preferences} from '../../preferences'
import {Network} from '../../types/Network'
import {Wallet} from '../../types/Wallet'
import {GroupedAddresses} from '../../types/GroupedAddresses'
import {OperationFee} from '../../types/Fee'
import {CoreSpendSource} from '../../types/CoinSelection'
import {PlatformInputOutcome} from '../../types/PlatformTransfer'
import {TransferInputSelection, TransferOutput} from '../../types/CoreTransaction'
import {PreviewParams, TransactionPreview} from '../../types/TransactionPreview'
import {UTXO} from '../../types/UTXO'
import {
  FeeOperation,
  FeeParams,
  SelectionFeeOperation,
  TransitionFeeOperation,
  UnsignedTransition,
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
  addressFundedTransition,
  coreChangeAndFee,
  coreInputEntries,
  coreRecipients,
  identityFundedTransition,
  platformInputEntries,
  platformRecipients,
  previewEntry,
  previewFeeParams,
  recipientEntries,
  recipientTotal,
  reducedRecipients,
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
  private core: CoreTransactionService
  private providers: WalletProviderFactory
  private preferences: Preferences

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    addresses: PlatformAddressService,
    platform: PlatformWorkerService,
    shielded: ShieldedService,
    core: CoreTransactionService,
    providers: WalletProviderFactory,
    preferences: Preferences,
  ) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.addresses = addresses
    this.platform = platform
    this.shielded = shielded
    this.core = core
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
    // Every operation pays something, even where the something is an identity
    // that does not exist yet, so the first recipient always names a payee.
    if (params.recipients.length === 0) throw new Error('A preview needs the recipients the send would pay')
    const feeParams = previewFeeParams(params)

    switch (operation) {
      case 'coreSend': {
        requireAutomaticInputs(params.platformSource)
        const recipients = coreRecipients(params.recipients)
        const amountDuffs = requireCoreRecipients(recipients)
        if (params.changeTo != null) this.core.requireChangeAddress(params.changeTo, wallet.network)
        // Which script an output takes is decided by the network the send runs
        // on, and deciding it is what refuses an address that is neither kind.
        const outputs: TransferOutput[] = recipients.map(recipient => ({
          ...recipient,
          recipientType: this.core.classifyAddress(recipient.address, wallet.network),
        }))

        const {selection, utxos} = await this.corePlan(
          wallet, params.coreSource ?? undefined, amountDuffs, outputs.length, 0, params.changeTo ?? undefined)
        const {change, feeDuffs} = coreChangeAndFee(selection, amountDuffs)
        const unsigned = this.core.buildTransfer({
          inputs: selection.transferInputs,
          outputs,
          changeAddress: selection.changeAddress,
          inputTotal: selection.inputTotal,
          feeDuffs: selection.feeDuffs,
        })

        return {
          inputs: coreInputEntries(selection.transferInputs, utxos),
          outputs: [...recipientEntries(params.recipients, 'duffs'), ...change],
          feeDuffs,
          feeCredits: null,
          unsignedHex: unsigned.hex(),
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
        const amountDuffs = recipientTotal(params.recipients)
        // The credits the lock will create, which is what the funding prices
        // itself against — an L1 form carries no amount in credits.
        const arriving = {...feeParams, amountCredits: amountDuffs * CREDITS_PER_DUFF}
        const feeCredits = await this.protocolFee(wallet, operation, arriving, 1)
        const lockDuffs = lockedDuffsFor(amountDuffs, feeCredits)
        // No change address of its own: a lock is funded through AssetLockService,
        // which never takes one.
        const {selection, utxos, grouped} =
          await this.corePlan(wallet, params.coreSource ?? undefined, lockDuffs, 1, ASSET_LOCK_PAYLOAD_BYTES)
        const {change, feeDuffs} = coreChangeAndFee(selection, lockDuffs)
        const creditAddress = pickCreditChangeAddress(grouped, selection.changeAddress).address
        const unsigned = this.core.buildAssetLock({
          inputs: selection.transferInputs,
          amountDuffs: lockDuffs,
          creditAddress,
          changeAddress: selection.changeAddress,
          inputTotal: selection.inputTotal,
          feeDuffs: selection.feeDuffs,
        })

        return {
          inputs: coreInputEntries(selection.transferInputs, utxos),
          outputs: [
            ...recipientEntries(params.recipients, 'duffs'),
            previewEntry('credit', creditAddress, lockDuffs, 'duffs'),
            ...change,
          ],
          feeDuffs,
          feeCredits,
          unsignedHex: unsigned.hex(),
        }
      }

      case 'shieldedTransfer':
      case 'unshield':
      case 'shieldedWithdrawal':
      case 'identityCreateFromShielded': {
        requireAutomaticSelection(params.coreSource)
        requireAutomaticInputs(params.platformSource)
        const plan = await this.shielded.planSpend(
          walletId, operation, params.amountCredits, params.shieldedSource ?? null, params.recipients.length)

        // A create is funded by the denomination itself: the fee comes out of
        // what the identity is left with, rather than out of the pool beside it.
        const creates = operation === 'identityCreateFromShielded'
        const payouts = creates
          ? [previewEntry('recipient', '', params.amountCredits - plan.feeCredits, 'credits')]
          : recipientEntries(params.recipients, 'credits')
        const changeCredits = plan.totalCredits - params.amountCredits - (creates ? 0n : plan.feeCredits)

        return {
          inputs: shieldedInputEntries(plan),
          outputs: [...payouts, ...shieldedChangeEntries(changeCredits)],
          feeDuffs: null,
          feeCredits: plan.feeCredits,
          unsignedHex: null,
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
        const coreRate = coreFeePerByte(this.preferences.general.coreFeeMultiplier)
        const transition = addressFundedTransition(operation, params, plan, coreRate)

        return {
          inputs: platformInputEntries(plan),
          outputs: recipientEntries(reducedRecipients(params.recipients, plan), 'credits'),
          feeDuffs: null,
          feeCredits: plan.feeCredits,
          unsignedHex: await this.unsignedHex(wallet.network, transition),
        }
      }

      case 'identityToAddress':
      case 'identityToIdentity':
      case 'identityWithdrawal': {
        requireAutomaticSelection(params.coreSource)
        requireAutomaticInputs(params.platformSource)
        const identifier = params.identityId
        if (identifier == null || identifier.length === 0) {
          throw new Error(`${operation} needs the identity that funds it`)
        }
        const feeCredits = await this.protocolFee(wallet, operation, feeParams, 1)
        // A transition is ordered by the identity's next nonce, which is the one
        // the send will submit it under.
        const {nonce} = await this.platform.request('identityNonce', wallet.network, {identifier})
        const coreRate = coreFeePerByte(this.preferences.general.coreFeeMultiplier)
        const transition = identityFundedTransition(operation, params, identifier, nonce + 1n, coreRate)

        return {
          inputs: [previewEntry('input', identifier, recipientTotal(params.recipients) + feeCredits, 'credits')],
          outputs: recipientEntries(params.recipients, 'credits'),
          feeDuffs: null,
          feeCredits,
          unsignedHex: await this.unsignedHex(wallet.network, transition),
        }
      }

      case 'shield': {
        requireAutomaticSelection(params.coreSource)
        requireAutomaticInputs(params.platformSource)
        const feeCredits = await this.protocolFee(wallet, operation, feeParams, 1)
        const candidates = await this.addresses.loadCandidates(wallet)
        const source = selectPlatformSource(candidates, params.amountCredits, feeCredits, params.fromAddress ?? undefined)

        return {
          inputs: [previewEntry('input', source.platformAddress, params.amountCredits + feeCredits, 'credits')],
          outputs: recipientEntries(params.recipients, 'credits'),
          feeDuffs: null,
          feeCredits,
          unsignedHex: null,
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

  // The worker builds what it would submit and stops there, so the bytes a
  // preview shows are the transition itself rather than a reading of one. Null
  // where there is no transition to build without the seed.
  private async unsignedHex(network: Network, transition: UnsignedTransition | null): Promise<string | null> {
    if (transition === null) return null
    const {unsignedHex} = await this.platform.request('previewTransition', network, transition)
    return unsignedHex
  }

  // selectTransferInputs is what the send itself calls, over the same coins at
  // the same rate, so a preview cannot pick a set the send would not. It is
  // also where an amount the wallet cannot fund refuses.
  private async corePlan(
    wallet: Wallet,
    source: CoreSpendSource | undefined,
    amountDuffs: bigint,
    outputsCount: number,
    payloadBytes: number,
    changeTo?: string,
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
      source,
      changeTo,
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
