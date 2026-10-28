import type { PreviewUnit } from '../api/types'
import type { VisibleRecipients } from '../types/TxSummary'
import { creditsToDuffs } from './balance'

export function txAmountToDuffs(amount: bigint, unit: PreviewUnit): bigint {
  return unit === 'credits' ? creditsToDuffs(amount) : amount
}

export function splitVisibleRecipients<T>(recipients: T[], limit: number): VisibleRecipients<T> {
  if (recipients.length <= limit) return { visible: recipients, hidden: 0 }
  return { visible: recipients.slice(0, limit), hidden: recipients.length - limit }
}

export function moreRecipientsLabel(hidden: number): string {
  return `+${hidden} more`
}
