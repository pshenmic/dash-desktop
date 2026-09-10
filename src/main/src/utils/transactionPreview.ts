import {DUST_THRESHOLD_DUFFS} from '../constants/chain'
import {CoreRecipient, TransferInput, TransferInputSelection} from '../types/CoreTransaction'
import {PlatformInputPlan} from '../types/PlatformTransfer'
import {ShieldedSpendPlan} from '../types/Shielded'
import {PreviewEntry, PreviewParams, PreviewRecipient, PreviewRole, PreviewUnit} from '../types/TransactionPreview'
import {UTXO} from '../types/UTXO'
import {toAddressInput} from './platformTransfer'
import {
  FeeParams,
  IdentityFeeOperation,
  Recipient,
  SelectionFeeOperation,
  UnsignedTransition,
} from '../../platform/types/messages'

const outpoint = (txid: string, vout: number): string => `${txid}:${vout}`

export function previewEntry(
  role: PreviewRole,
  address: string,
  amount: bigint,
  unit: PreviewUnit,
  reference: string | null = null,
): PreviewEntry {
  return {role, address, amount, unit, reference}
}

// A quote counts outputs; a preview shows what each one is paid. What is left
// over is what a price is asked for, unchanged — the two addresses no fee
// depends on are dropped rather than carried to the worker.
export function previewFeeParams(params: PreviewParams): FeeParams {
  const {recipients, changeTo: _changeTo, fromAddress: _fromAddress, ...priced} = params
  return {...priced, recipient: recipients.map(recipient => recipient.address)}
}

export function recipientTotal(recipients: PreviewRecipient[]): bigint {
  return recipients.reduce((sum, recipient) => sum + recipient.amount, 0n)
}

// The two shapes the sends themselves take, so a preview runs their validators
// rather than a second reading of the same rules.
export function coreRecipients(recipients: PreviewRecipient[]): CoreRecipient[] {
  return recipients.map(recipient => ({address: recipient.address, amountDuffs: recipient.amount}))
}

export function platformRecipients(recipients: PreviewRecipient[]): Recipient[] {
  return recipients.map(recipient => ({address: recipient.address, amountCredits: recipient.amount}))
}

export function recipientEntries(recipients: PreviewRecipient[], unit: PreviewUnit): PreviewEntry[] {
  return recipients.map(recipient => previewEntry('recipient', recipient.address, recipient.amount, unit))
}

// The selection names the coins it will spend but not what they hold, so the
// amounts come back from the set it picked them out of.
export function coreInputEntries(inputs: TransferInput[], utxos: UTXO[]): PreviewEntry[] {
  const held = new Map(utxos.map(utxo => [outpoint(utxo.txId, utxo.vOut), utxo.satoshis]))
  return inputs.map(input => {
    const reference = outpoint(input.txId, input.vOut)
    const satoshis = held.get(reference)
    if (satoshis == null) throw new Error('Selected UTXO no longer available')
    return previewEntry('input', input.address, satoshis, 'duffs', reference)
  })
}

// The change output, and what the transaction really pays to write it. Change
// follows the builder rather than the arithmetic: below the dust threshold it is
// written as no output at all, so the miner takes it and the send costs more
// than the selection quoted.
export function coreChangeAndFee(
  selection: TransferInputSelection,
  paidDuffs: bigint,
): {change: PreviewEntry[]; feeDuffs: bigint} {
  const changeDuffs = selection.inputTotal - paidDuffs - selection.feeDuffs
  return changeDuffs >= DUST_THRESHOLD_DUFFS
    ? {change: [previewEntry('change', selection.changeAddress, changeDuffs, 'duffs')], feeDuffs: selection.feeDuffs}
    : {change: [], feeDuffs: selection.feeDuffs + changeDuffs}
}

// Consensus can take the fee out of an output instead of an input, in which
// case that recipient is paid less than the caller named.
export function reducedRecipients(recipients: PreviewRecipient[], plan: PlatformInputPlan): PreviewRecipient[] {
  const reduced = plan.feeStrategy.find(step => step.kind === 'reduceOutput')?.index
  return recipients.map((recipient, index) =>
    index === reduced ? {...recipient, amount: recipient.amount - plan.feeCredits} : recipient)
}

// Which input pays is a position in the inputs as they are submitted, which is
// the order the plan holds them in. Consensus takes that fee out of the
// address's remaining balance rather than out of what its input draws, so the
// address it names gives up both.
export function platformInputEntries(plan: PlatformInputPlan): PreviewEntry[] {
  const charged = plan.feeStrategy.find(step => step.kind === 'deductFromInput')?.index
  return plan.inputs.map((input, index) => previewEntry(
    index === charged ? 'feeInput' : 'input',
    input.candidate.platformAddress,
    index === charged ? input.credits + plan.feeCredits : input.credits,
    'credits',
  ))
}

// Which transition an address-funded operation would submit, in the shape the
// worker builds it from. Creating an identity has none to show: its transition
// carries public keys only the seed can derive.
export function addressFundedTransition(
  operation: SelectionFeeOperation,
  params: PreviewParams,
  plan: PlatformInputPlan,
  coreFeePerByte: number,
): UnsignedTransition | null {
  const inputs = plan.inputs.map(({candidate, credits}) => toAddressInput(candidate, credits))
  const {feeStrategy} = plan

  switch (operation) {
    case 'addressFundsTransfer':
      return {kind: 'addressFundsTransfer', inputs, feeStrategy, recipients: platformRecipients(params.recipients)}
    case 'addressWithdrawal':
      return {kind: 'addressWithdrawal', inputs, feeStrategy, coreAddress: params.recipients[0].address, coreFeePerByte}
    case 'identityTopUp':
      return {kind: 'identityTopUpFromAddresses', identifier: params.recipients[0].address, inputs, feeStrategy}
    case 'identityCreate':
      return null
  }
}

// The same for the three an identity funds out of its own balance, which is why
// each one is ordered by a nonce rather than by the inputs it spends.
export function identityFundedTransition(
  operation: IdentityFeeOperation,
  params: PreviewParams,
  identifier: string,
  nonce: bigint,
  coreFeePerByte: number,
): UnsignedTransition {
  switch (operation) {
    case 'identityToAddress':
      return {kind: 'identityCreditsToAddresses', identifier, nonce, recipients: platformRecipients(params.recipients)}
    case 'identityToIdentity':
      return {
        kind: 'identityCreditTransfer',
        identifier,
        nonce,
        recipientIdentifier: params.recipients[0].address,
        amountCredits: params.amountCredits,
      }
    case 'identityWithdrawal':
      return {
        kind: 'identityWithdrawal',
        identifier,
        nonce,
        amountCredits: params.amountCredits,
        coreAddress: params.recipients[0].address,
        coreFeePerByte,
      }
  }
}

export function shieldedInputEntries(plan: ShieldedSpendPlan): PreviewEntry[] {
  return plan.notes.map(note =>
    previewEntry('input', note.address, note.amountCredits, 'credits', `note ${note.index}`))
}

// What the pool hands back to itself once the payout and the fee have left. It
// has no address here: the change note is diversified in the worker, off the
// seed the spend holds.
export function shieldedChangeEntries(changeCredits: bigint): PreviewEntry[] {
  return changeCredits > 0n ? [previewEntry('change', '', changeCredits, 'credits')] : []
}
