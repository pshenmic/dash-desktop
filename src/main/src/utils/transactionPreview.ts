import {DUST_THRESHOLD_DUFFS} from '../constants/chain'
import {CoreRecipient, TransferInput} from '../types/CoreTransaction'
import {FeeStrategyStep, PlatformInputPlan} from '../types/PlatformTransfer'
import {ShieldedSpendPlan} from '../types/Shielded'
import {PreviewEntry, PreviewParams, PreviewRecipient, PreviewRole, PreviewUnit} from '../types/TransactionPreview'
import {UTXO} from '../types/UTXO'
import {FeeParams, Recipient} from '../../platform/types/messages'

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

export function previewTotal(recipients: PreviewRecipient[]): bigint {
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

// Change follows the transaction builder rather than the arithmetic: what is
// left below the dust threshold is written as no output at all, so the miner
// takes it and the transaction pays more than the selection quoted.
export function coreChangeAndFee(
  changeAddress: string,
  changeDuffs: bigint,
  feeDuffs: bigint,
): {change: PreviewEntry[]; feeDuffs: bigint} {
  return changeDuffs >= DUST_THRESHOLD_DUFFS
    ? {change: [previewEntry('change', changeAddress, changeDuffs, 'duffs')], feeDuffs}
    : {change: [], feeDuffs: feeDuffs + changeDuffs}
}

// Consensus can take the fee out of an output instead of an input, in which
// case that recipient is paid less than the caller named it.
export function reducedRecipientEntries(
  recipients: PreviewRecipient[],
  feeCredits: bigint,
  feeStrategy: FeeStrategyStep[],
): PreviewEntry[] {
  const reduced = feeStrategy.find(step => step.kind === 'reduceOutput')?.index
  return recipients.map((recipient, index) => previewEntry(
    'recipient',
    recipient.address,
    index === reduced ? recipient.amount - feeCredits : recipient.amount,
    'credits',
  ))
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
