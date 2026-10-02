import type { Network, PlatformTransaction } from '../api/types'
import type { PresentedPlatformTransaction, TransactionCardItem, WalletTransactionOwnership } from '../types/WalletTransaction'
import { PLATFORM_TX_CARD_STATUSES } from '../constants/platformTransactions'
import { formatCreationDate, timePart } from './date'
import { identityUrl, platformAddressUrl } from './explorer'
import { isValidPlatformAddress } from './platformAddress'
import { isLikelyIdentityId } from './transferMatrix'

export function platformTransactionTitle(type: string): string {
  return type.trim().toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Unknown operation'
}

export function platformTransactionStatus(status: PlatformTransaction['status']): string {
  if (status === 'SUCCESS') return 'Success'
  if (status === 'FAIL') return 'Failed'
  return 'Status unavailable'
}

export function platformTransactionDate(date: Date, includeTime = false): string {
  if (platformTransactionDateValue(date) === null) return 'Date unavailable'
  return includeTime ? `${formatCreationDate(date)} ${timePart(date)}` : formatCreationDate(date)
}

export function platformTransactionDateValue(date: Date): Date | null {
  return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date : null
}

export function platformInternalTransferFee(transaction: PlatformTransaction, ownership: WalletTransactionOwnership): bigint | null {
  if (ownership.walletId !== transaction.walletId || transaction.status === 'FAIL' || transaction.error || transaction.gasCredits <= 0n) return null
  if (transaction.sender.length === 0 || transaction.recipient.length === 0) return null
  if ([...transaction.sender, ...transaction.recipient].some(end => end.amount <= 0n)) return null

  if (transaction.type === 'CREDIT_TRANSFER' || transaction.type === 'IDENTITY_CREDIT_TRANSFER') {
    const [sender] = transaction.sender
    const [recipient] = transaction.recipient
    if (transaction.sender.length !== 1 || transaction.recipient.length !== 1 || !ownership.identities.has(sender.source) || !ownership.identities.has(recipient.source)) return null
    return sender.source !== recipient.source && sender.amount === recipient.amount ? transaction.gasCredits : null
  }

  if (transaction.status !== 'SUCCESS' || transaction.blockHeight == null || transaction.blockHeight <= 0) return null

  if (transaction.type === 'ADDRESS_FUNDS_TRANSFER') {
    return [...transaction.sender, ...transaction.recipient].every(end => ownership.platform.has(end.source))
      ? transaction.gasCredits : null
  }

  switch (transaction.type) {
    case 'UNSHIELD':
      if (!transaction.sender.every(end => ownership.shielded.has(end.source))) return null
      if (!transaction.recipient.some(end => ownership.platform.has(end.source))) return null
      if (!transaction.recipient.every(end => ownership.platform.has(end.source) || ownership.shielded.has(end.source))) return null
      break
    case 'IDENTITY_TOP_UP_FROM_ADDRESSES':
    case 'IDENTITY_CREATE_FROM_ADDRESSES':
      if (!transaction.sender.every(end => ownership.platform.has(end.source))) return null
      if (transaction.recipient.filter(end => ownership.identities.has(end.source)).length !== 1) return null
      if (!transaction.recipient.every(end => ownership.identities.has(end.source) || ownership.platform.has(end.source))) return null
      break
    case 'IDENTITY_CREDIT_TRANSFER_TO_ADDRESS':
    case 'IDENTITY_CREDIT_TRANSFER_TO_ADDRESSES':
      if (transaction.sender.length !== 1 || !ownership.identities.has(transaction.sender[0].source)) return null
      if (!transaction.recipient.every(end => ownership.platform.has(end.source))) return null
      break
    default:
      return null
  }

  const sent = transaction.sender.reduce((total, end) => total + end.amount, 0n)
  const received = transaction.recipient.reduce((total, end) => total + end.amount, 0n)
  const difference = sent - received
  if (transaction.type === 'UNSHIELD') return difference === transaction.gasCredits ? transaction.gasCredits : null
  return difference === 0n || difference === transaction.gasCredits ? transaction.gasCredits : null
}

export function mapPlatformTransaction(transaction: PresentedPlatformTransaction): TransactionCardItem {
  const internalFee = transaction.internalTransferFeeCredits
  let direction: TransactionCardItem['direction'] = 'neutral'
  if (transaction.netCredits > 0n) direction = 'in'
  if (transaction.netCredits < 0n) direction = 'out'
  if (internalFee !== undefined) direction = 'out'

  // An address transition names only our own end, so the card shows whichever
  // end the source named rather than the one the direction asks for.
  const fromSender = direction === 'in' ? transaction.sender.length > 0 : transaction.recipient.length === 0
  const participants = fromSender ? transaction.sender : transaction.recipient

  return {
    id: transaction.hash,
    status: PLATFORM_TX_CARD_STATUSES[transaction.status ?? 'unknown'],
    kind: 'platform',
    title: platformTransactionTitle(transaction.type),
    ...(internalFee !== undefined && { internalTransfer: true }),
    subtitleLabel: fromSender ? 'From' : 'To',
    labelValue: participants.length > 1
      ? `${participants.length} ${fromSender ? 'inputs' : 'outputs'}`
      : participants.map(end => end.source).join(', ') || 'Unavailable',
    amount: internalFee ?? transaction.amountCredits,
    date: platformTransactionDateValue(transaction.date),
    direction,
  }
}

export function platformParticipantUrl(value: string, network: Network): string | null {
  if (isValidPlatformAddress(value, network)) return platformAddressUrl(value, network)
  if (isLikelyIdentityId(value)) return identityUrl(value, network)
  return null
}
