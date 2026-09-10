import type { SendPreviewInputsParams, SendPreviewOutputsParams, SendPreviewRow, SendPreviewSourceParams } from '../types/SendTransactionPreview'
import { duffsToCredits } from './balance'
import { coreSpendSourceKey, outpointKey, platformSpendSourceKey } from './coinControl'

export function sendPreviewSourceKey({network, coreSource, platformSource, shieldedSource, fixedAddress}: SendPreviewSourceParams): string {
  return JSON.stringify([
    network, coreSpendSourceKey(coreSource), platformSpendSourceKey(platformSource),
    shieldedSource?.kind, shieldedSource?.noteIndexes, fixedAddress,
  ])
}

export function sendPreviewTotals(outputs: SendPreviewRow[], feeCredits: bigint) {
  const amountCredits = outputs.reduce((sum, output) => sum + (output.amountCredits ?? 0n), 0n)
  return {amountCredits, feeCredits, totalDebitCredits: amountCredits + feeCredits}
}

export function sendPreviewInputs({selection, funds, fixedAddress, fixedCredits, feeFromOutput}: SendPreviewInputsParams): SendPreviewRow[] {
  if (fixedAddress) return [{address: fixedAddress, amountCredits: fixedCredits ?? null}]
  switch (selection.kind) {
    case 'coreOutpoints': {
      const selected = new Set(selection.outpoints)
      return funds.utxos.filter(input => selected.has(outpointKey(input))).map(input => ({
        address: input.address, amountCredits: duffsToCredits(input.satoshis), reference: outpointKey(input),
      }))
    }
    case 'coreAddress':
      return [{address: selection.address, amountCredits: null}]
    case 'platformInputs':
      return selection.inputs.map(input => ({
        address: input.address, amountCredits: input.credits,
        label: !feeFromOutput && input.address === selection.feeAddress ? 'Fee input' : undefined,
      }))
    case 'platformAddress':
    case 'shieldedAddress':
      return [{address: selection.address, amountCredits: null}]
    case 'shieldedNotes': {
      const selected = new Set(selection.noteIndexes)
      return funds.shieldedNotes.filter(note => !note.spent && selected.has(note.index)).map(note => ({
        address: note.address, amountCredits: note.amount, reference: `Note ${note.index}`,
      }))
    }
    default:
      return []
  }
}

export function sendPreviewOutputs({recipients, feeCredits, feeOutputIndex, newIdentity}: SendPreviewOutputsParams): SendPreviewRow[] {
  return recipients.map((recipient, index) => ({
    address: newIdentity ? '' : recipient.address,
    amountCredits: duffsToCredits(recipient.amountDuffs) - (feeOutputIndex === index ? feeCredits : 0n),
    label: newIdentity ? 'New Platform identity' : feeOutputIndex === index ? 'Fee deducted' : undefined,
  }))
}
