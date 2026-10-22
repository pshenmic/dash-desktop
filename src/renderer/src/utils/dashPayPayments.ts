import type { DashPayPaymentDto } from '@renderer/api/types'
import { DASHPAY_PAYMENT_COPY } from '@renderer/constants/dashPay'
import { DashPayPaymentDirection } from '@renderer/enums/DashPay'
import type { PaymentTotals } from '@renderer/types/DashPay'
import type { TransactionCardItem } from '@renderer/types/WalletTransaction'

export function paymentTotals(payments: DashPayPaymentDto[]): PaymentTotals {
  const totals: PaymentTotals = { sent: 0n, received: 0n }
  for (const payment of payments) {
    if (payment.direction === DashPayPaymentDirection.Sent) totals.sent += payment.amountDuffs
    else totals.received += payment.amountDuffs
  }
  return totals
}

export function dashPayPaymentCard(payment: DashPayPaymentDto, contactName: string): TransactionCardItem {
  const sent = payment.direction === DashPayPaymentDirection.Sent
  return {
    id: payment.txid,
    status: 'success',
    kind: 'core',
    title: `${sent ? DASHPAY_PAYMENT_COPY.sentTo : DASHPAY_PAYMENT_COPY.receivedFrom} ${contactName}`,
    subtitleLabel: DASHPAY_PAYMENT_COPY.transactionId,
    labelValue: payment.txid,
    amount: payment.amountDuffs,
    date: new Date(payment.date),
    direction: sent ? 'out' : 'in',
  }
}
