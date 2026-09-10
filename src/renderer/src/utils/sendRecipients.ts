import { bech32m } from '@scure/base'
import type { PlatformSpendSource } from '../api/types'
import { DestinationKind } from '../enums/DestinationKind'
import { TransferOperation } from '../enums/TransferOperation'
import { CORE_RECIPIENT_MIN_DUFFS, PLATFORM_ADDRESS_TYPE_BYTES, PLATFORM_RECIPIENT_MIN_CREDITS, SEND_AMOUNT_PATTERN } from '../constants/sendRecipients'
import type { SendRecipientDraft } from '../types/SendDraft'
import type { SendRecipientError, SendRecipientValidation } from '../types/SendRecipients'
import { dashToDuffs, davToDash, duffsToCredits } from './balance'
import { isValidDashAddress } from './address'
import { isValidPlatformAddress } from './platformAddress'
import { isLikelyShieldedAddress } from './shieldedAddress'

export function recipientTotalDuffs(recipients: SendRecipientDraft[]): bigint {
  return recipients.reduce((total, recipient) => total + dashToDuffs(recipient.amount), 0n)
}

export function recipientAllocationBudget(available: bigint | null, quotedMax: bigint | null, quoteReady: boolean): bigint | null {
  if (available == null) return null
  if (available <= 0n) return 0n
  if (!quoteReady || quotedMax == null) return available
  if (quotedMax < 0n) return 0n
  return quotedMax < available ? quotedMax : available
}

export function recipientRemainingDuffs(recipients: SendRecipientDraft[], id: string, budget: bigint): bigint {
  const remaining = budget - recipientTotalDuffs(recipients.filter(recipient => recipient.id !== id))
  return remaining > 0n ? remaining : 0n
}

export function recipientSliderAmount(recipients: SendRecipientDraft[], id: string, budget: bigint, percent: number): string {
  const requested = budget * BigInt(Math.round(Math.max(0, Math.min(100, percent)))) / 100n
  const remaining = recipientRemainingDuffs(recipients, id, budget)
  return davToDash(requested > remaining ? remaining : requested)
}

export function recipientPercent(amount: bigint, budget: bigint | null): number {
  if (budget == null || budget <= 0n || amount <= 0n) return 0
  return amount >= budget ? 100 : Number(amount * 100n / budget)
}

export function splitRecipientTotal(recipients: SendRecipientDraft[]): SendRecipientDraft[] {
  if (recipients.length === 0) return recipients
  const total = recipientTotalDuffs(recipients)
  const count = BigInt(recipients.length)
  return recipients.map((recipient, index) => ({
    ...recipient,
    amount: davToDash(total / count + (index === recipients.length - 1 ? total % count : 0n)),
  }))
}

export function validateSendRecipients(params: SendRecipientValidation): SendRecipientError[] {
  const {recipients, operation, destination, network, fundingAddresses, feeRecipientId, feeCredits} = params
  const platform = destination === DestinationKind.PlatformAddress
  const addresses = recipients.map(recipient => platform ? recipient.address.trim().toLowerCase() : recipient.address.trim())
  return recipients.map((recipient, index) => {
    const address = addresses[index]
    let addressError: string | null = null
    let valid: boolean
    if (destination === DestinationKind.CoreAddress) {
      valid = isValidDashAddress(address, network ?? undefined)
    } else if (platform) {
      valid = isValidPlatformAddress(recipient.address.trim(), network ?? undefined)
    } else {
      valid = isLikelyShieldedAddress(address)
    }
    if (!valid) addressError = 'Enter a valid recipient address for this network.'
    else if (platform && addresses.indexOf(address) !== index) addressError = 'Each Platform recipient can appear only once.'
    else if (operation === TransferOperation.AddressFundsTransfer && fundingAddresses.some(source => source.toLowerCase() === address)) {
      addressError = 'Recipient cannot also be a funding address.'
    }
    const duffs = dashToDuffs(recipient.amount)
    let amountError: string | null = null
    if (!SEND_AMOUNT_PATTERN.test(recipient.amount) || duffs <= 0n) amountError = 'Enter an amount greater than zero (up to 8 decimals).'
    else if (operation === TransferOperation.CoreSend && duffs < CORE_RECIPIENT_MIN_DUFFS) amountError = `Minimum per recipient is ${davToDash(CORE_RECIPIENT_MIN_DUFFS)} Dash.`
    else if (operation !== TransferOperation.CoreSend) {
      const net = duffsToCredits(duffs) - (recipient.id === feeRecipientId ? feeCredits ?? 0n : 0n)
      if (net < PLATFORM_RECIPIENT_MIN_CREDITS) amountError = 'Recipient must receive at least 0.000005 Dash after fees.'
    }
    return {address: addressError, amount: amountError}
  })
}

// Platform builders sort their outputs by address bytes before resolving fee indexes.
export function orderPlatformRecipients(recipients: SendRecipientDraft[]): SendRecipientDraft[] {
  if (!recipients.every(recipient => isValidPlatformAddress(recipient.address))) return recipients
  const entries = recipients.map(recipient => ({
    recipient: {...recipient, address: recipient.address.trim().toLowerCase()},
    bytes: bech32m.fromWords(bech32m.decode(recipient.address.trim() as `${string}1${string}`, 90).words),
  }))
  for (const entry of entries) entry.bytes[0] = PLATFORM_ADDRESS_TYPE_BYTES[entry.bytes[0]] ?? entry.bytes[0]
  entries.sort((a, b) => {
    for (let i = 0; i < a.bytes.length; i++) {
      if (a.bytes[i] !== b.bytes[i]) return a.bytes[i] - b.bytes[i]
    }
    return 0
  })
  return entries.map(entry => entry.recipient)
}

export function withOutputFee(source: PlatformSpendSource | null, outputIndex: number | undefined): PlatformSpendSource | null {
  if (source?.kind !== 'inputs' || outputIndex == null || outputIndex < 0) return source
  return {...source, feeStrategy: [{kind: 'reduceOutput', index: outputIndex}]}
}
