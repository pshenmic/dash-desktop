import { describe, it, expect } from 'vitest'
import { amountErrorFor } from '../../src/renderer/src/utils/amountValidation'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import { AmountValidationParams } from '../../src/renderer/src/api/types'
import { SHIELDED_BALANCE_UNKNOWN_ERROR } from '../../src/renderer/src/constants/sendPages'

function params(overrides: Partial<AmountValidationParams> = {}): AmountValidationParams {
  return {
    isCoreOperation: false,
    amount: '0.00001',
    totalFeeDuffs: 10_000n,
    operation: TransferOperation.AddressFundsTransfer,
    amountDuffs: 1_000n,
    balanceDuffs: 0n,
    amountCredits: 1_000_000n,
    minCredits: 500_000n,
    availableCredits: 900_000_000n,
    feeCredits: 100_000n,
    maxPerTx: null,
    noteLimit: null,
    ...overrides,
  }
}

describe('amountErrorFor', () => {
  it('accepts a Dash amount with room for the fixed network fee', () => {
    expect(amountErrorFor(params({
      isCoreOperation: true,
      amount: '0.9999',
      amountDuffs: 99_990_000n,
      balanceDuffs: 100_000_000n,
      amountCredits: 0n,
    }))).toBeNull()
  })

  // An L1 -> L2 transfer locks the L2 fee alongside the amount, so both fees
  // reach here already summed into one Dash figure.
  it('reports the max after both fees on an L1 -> L2 transfer', () => {
    expect(amountErrorFor(params({
      isCoreOperation: true,
      operation: TransferOperation.AssetLockFunding,
      amount: '1',
      amountDuffs: 100_000_000n,
      balanceDuffs: 100_000_000n,
      totalFeeDuffs: 66_000n,
      amountCredits: 0n,
      feeCredits: 56_000_000n,
    }))).toBe('Max sendable is 0.99934 Dash after fees.')
  })

  it('reports the max Dash amount after the fixed network fee', () => {
    expect(amountErrorFor(params({
      isCoreOperation: true,
      amount: '1',
      amountDuffs: 100_000_000n,
      balanceDuffs: 100_000_000n,
      amountCredits: 0n,
    }))).toBe('Max sendable is 0.9999 Dash after fees.')
  })

  it('is silent while nothing has been typed', () => {
    expect(amountErrorFor(params({amount: '', amountCredits: 0n}))).toBeNull()
  })

  it('rejects a pool identity amount that is not a fixed denomination', () => {
    const error = amountErrorFor(params({
      operation: TransferOperation.IdentityCreateFromShielded,
      amountCredits: 10_000_000_001n,
      minCredits: 10_000_000_000n,
    }))
    expect(error).toBe('Pick one of the fixed denominations above.')
  })

  it('accepts a fixed pool identity denomination', () => {
    const error = amountErrorFor(params({
      operation: TransferOperation.IdentityCreateFromShielded,
      amountCredits: 10_000_000_000n,
      minCredits: 10_000_000_000n,
      availableCredits: 90_000_000_000n,
    }))
    expect(error).toBeNull()
  })

  it('reports the operation minimum', () => {
    expect(amountErrorFor(params({amountCredits: 499_999n}))).toBe('Minimum is 0.000005 Dash.')
  })

  it('reports an unknown shielded balance', () => {
    expect(amountErrorFor(params({availableCredits: null}))).toBe(SHIELDED_BALANCE_UNKNOWN_ERROR)
  })

  it('stays silent while the fee is still unknown', () => {
    expect(amountErrorFor(params({feeCredits: null, amountCredits: 900_000_000n}))).toBeNull()
  })

  it('reports amount plus fee exceeding the balance', () => {
    const error = amountErrorFor(params({amountCredits: 900_000_000n, feeCredits: 100_000n, availableCredits: 900_000_000n}))
    expect(error).toBe('Amount plus the 0.000001 Dash fee exceeds this balance.')
  })

  it('reports the per-transaction cap', () => {
    const error = amountErrorFor(params({amountCredits: 800_000_000n, maxPerTx: 700_000_000n, noteLimit: 6}))
    expect(error).toBe('Max per transaction right now is 0.007 Dash (network fee + 6-note limit).')
  })

  it('is silent when the amount fits the balance, the fee and the cap', () => {
    expect(amountErrorFor(params({amountCredits: 1_000_000n, maxPerTx: 700_000_000n}))).toBeNull()
  })

  it('prefers the minimum over the balance complaint', () => {
    expect(amountErrorFor(params({amountCredits: 1n, availableCredits: 0n}))).toBe('Minimum is 0.000005 Dash.')
  })
})
