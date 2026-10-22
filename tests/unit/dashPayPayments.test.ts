import { describe, expect, it } from 'vitest'
import { dashPayPaymentCard, paymentTotals } from '../../src/renderer/src/utils/dashPayPayments'
import { DashPayPaymentDirection } from '../../src/renderer/src/enums/DashPay'
import type { DashPayPaymentDto } from '../../src/renderer/src/api/types'

const sent: DashPayPaymentDto = { txid: 'aa'.repeat(32), amountDuffs: 25_000_000n, direction: DashPayPaymentDirection.Sent, date: 1_760_950_000_000 }
const received: DashPayPaymentDto = { txid: 'bb'.repeat(32), amountDuffs: 50_000_000n, direction: DashPayPaymentDirection.Received, date: 1_760_000_000_000 }

describe('paymentTotals', () => {
  it('sums each direction in duffs', () => {
    expect(paymentTotals([sent, received, { ...sent, amountDuffs: 1n }])).toEqual({ sent: 25_000_001n, received: 50_000_000n })
    expect(paymentTotals([])).toEqual({ sent: 0n, received: 0n })
  })
})

describe('dashPayPaymentCard', () => {
  it('maps a sent payment onto an outgoing core card', () => {
    expect(dashPayPaymentCard(sent, 'alice.dash')).toEqual({
      id: sent.txid,
      status: 'success',
      kind: 'core',
      title: 'Sent to alice.dash',
      subtitleLabel: 'Transaction ID',
      labelValue: sent.txid,
      amount: 25_000_000n,
      date: new Date(sent.date),
      direction: 'out',
    })
  })

  it('maps a received payment onto an incoming card', () => {
    expect(dashPayPaymentCard(received, 'alice.dash')).toMatchObject({ title: 'Received from alice.dash', direction: 'in', amount: 50_000_000n })
  })
})
