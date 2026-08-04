import { describe, it, expect } from 'vitest'
import { amountErrorFor } from '../../src/renderer/src/utils/amountValidation'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import { AmountValidationParams } from '../../src/renderer/src/api/types'
import { SHIELDED_BALANCE_UNKNOWN_ERROR } from '../../src/renderer/src/constants/sendPages'

function params(overrides: Partial<AmountValidationParams> = {}): AmountValidationParams {
  return {
    isDashUnit: false,
    amount: '1000000',
    operation: TransferOperation.AddressFundsTransfer,
    amountCredits: 1_000_000n,
    minCredits: 500_000n,
    availableCredits: 900_000_000n,
    feeCredits: 100_000n,
    maxPerTx: null,
    ...overrides,
  }
}

describe('amountErrorFor', () => {
  it('is silent for Dash-denominated operations', () => {
    expect(amountErrorFor(params({isDashUnit: true, amountCredits: 0n, minCredits: 500_000n}))).toBeNull()
  })

  it('is silent while nothing has been typed', () => {
    expect(amountErrorFor(params({amount: '', amountCredits: 0n}))).toBeNull()
  })

  it('rejects a pool identity amount that is not a fixed denomination', () => {
    const error = amountErrorFor(params({
      operation: TransferOperation.IdentityCreateFromPool,
      amountCredits: 10_000_000_001n,
      minCredits: 10_000_000_000n,
    }))
    expect(error).toBe('Pick one of the fixed denominations above.')
  })

  it('accepts a fixed pool identity denomination', () => {
    const error = amountErrorFor(params({
      operation: TransferOperation.IdentityCreateFromPool,
      amountCredits: 10_000_000_000n,
      minCredits: 10_000_000_000n,
      availableCredits: 90_000_000_000n,
    }))
    expect(error).toBeNull()
  })

  it('reports the operation minimum', () => {
    expect(amountErrorFor(params({amountCredits: 499_999n}))).toBe('Minimum is 500,000 credits.')
  })

  it('reports an unknown shielded balance', () => {
    expect(amountErrorFor(params({availableCredits: null}))).toBe(SHIELDED_BALANCE_UNKNOWN_ERROR)
  })

  it('stays silent while the fee is still unknown', () => {
    expect(amountErrorFor(params({feeCredits: null, amountCredits: 900_000_000n}))).toBeNull()
  })

  it('reports amount plus fee exceeding the balance', () => {
    const error = amountErrorFor(params({amountCredits: 900_000_000n, feeCredits: 100_000n, availableCredits: 900_000_000n}))
    expect(error).toBe('Amount plus the 100,000 credit fee exceeds this balance.')
  })

  it('reports the per-transaction cap', () => {
    const error = amountErrorFor(params({amountCredits: 800_000_000n, maxPerTx: 700_000_000n}))
    expect(error).toBe('Max per transaction right now is 700,000,000 credits (network fee + 6-note limit).')
  })

  it('is silent when the amount fits the balance, the fee and the cap', () => {
    expect(amountErrorFor(params({amountCredits: 1_000_000n, maxPerTx: 700_000_000n}))).toBeNull()
  })

  it('prefers the minimum over the balance complaint', () => {
    expect(amountErrorFor(params({amountCredits: 1n, availableCredits: 0n}))).toBe('Minimum is 500,000 credits.')
  })
})
