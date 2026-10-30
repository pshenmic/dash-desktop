import { DASH_UNIT } from '../constants/balance'
import { RECEIVE_INVOICE_COPY } from '../constants/receiveInvoice'
import { SEND_AMOUNT_PATTERN } from '../constants/sendRecipients'

export function receiveAmountParam(amount: string): string | null {
  if (!SEND_AMOUNT_PATTERN.test(amount)) return null
  const [whole, fraction = ''] = amount.split('.')
  const units = whole.replace(/^0+/, '') || '0'
  const decimals = fraction.replace(/0+$/, '')
  if (units === '0' && decimals === '') return null
  return decimals === '' ? units : `${units}.${decimals}`
}

export function corePaymentUri(address: string, amount: string | null): string {
  return amount == null ? `dash:${address}` : `dash:${address}?amount=${amount}`
}

export function receiveInvoiceHeadline(amount: string | null): string {
  return amount == null ? RECEIVE_INVOICE_COPY.anyAmount : `${RECEIVE_INVOICE_COPY.pay} ${amount} ${DASH_UNIT}`
}

export function wrapByWidth(units: string[], maxWidth: number, measure: (line: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const unit of units) {
    const next = line + unit
    if (line !== '' && measure(next.trimEnd()) > maxWidth) {
      lines.push(line.trimEnd())
      line = unit.trimStart()
    } else {
      line = next
    }
  }
  return line === '' ? lines : [...lines, line.trimEnd()]
}
