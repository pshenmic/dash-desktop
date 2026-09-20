import type { Network, PlatformTransaction } from '../api/types'
import type { TransactionCardItem } from '../types/WalletTransaction'
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

export function mapPlatformTransaction(transaction: PlatformTransaction): TransactionCardItem {
  let direction: TransactionCardItem['direction'] = 'neutral'
  if (transaction.netCredits > 0n) direction = 'in'
  if (transaction.netCredits < 0n) direction = 'out'

  // An address transition names only our own end, so the card shows whichever
  // end the source named rather than the one the direction asks for.
  const fromSender = direction === 'in' ? transaction.sender !== null : transaction.recipient === null

  return {
    id: transaction.hash,
    status: PLATFORM_TX_CARD_STATUSES[transaction.status ?? 'unknown'],
    kind: 'platform',
    title: platformTransactionTitle(transaction.type),
    subtitleLabel: fromSender ? 'From' : 'To',
    labelValue: (fromSender ? transaction.sender : transaction.recipient) ?? 'Unavailable',
    amount: transaction.amountCredits,
    date: platformTransactionDateValue(transaction.date),
    direction,
  }
}

export function platformParticipantUrl(value: string, network: Network): string | null {
  if (isValidPlatformAddress(value, network)) return platformAddressUrl(value, network)
  if (isLikelyIdentityId(value)) return identityUrl(value, network)
  return null
}
