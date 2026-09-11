import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {OperationFee, OperationFeeParams} from '../../src/renderer/src/api/types'
import {TransferOperation} from '../../src/renderer/src/enums/TransferOperation'
import {operationFeeRequest} from '../../src/renderer/src/utils/operationFee'
import {hasUnallocatedCoreFunds} from '../../src/renderer/src/utils/changeAddress'

const harness = vi.hoisted(() => ({
  settled: null as unknown,
  effectKey: undefined as unknown,
  cleanup: undefined as (() => void) | undefined,
  quote: {
    data: null as {key: string; maxKey: string; fee: OperationFee} | null,
    loading: false,
    err: null as string | null,
  },
}))

vi.mock('react', () => ({
  useState: () => [harness.settled, (value: unknown) => { harness.settled = value }],
  useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
    if (harness.effectKey === deps[0]) return
    harness.cleanup?.()
    harness.effectKey = deps[0]
    harness.cleanup = effect()
  },
}))
vi.mock('@renderer/hooks/useAsyncWithCache', () => ({useAsyncWithCache: () => harness.quote, invalidateAsyncCache: vi.fn()}))

import {useOperationFee} from '../../src/renderer/src/hooks/useOperationFee'

function params(overrides: Partial<OperationFeeParams> = {}): OperationFeeParams {
  return {destinationValid: false, recipient: [''], amountCredits: 50_000n, amountDuffs: 50n, ...overrides}
}

function settleQuote(input: OperationFeeParams, maxDuffs = 100n): void {
  const request = operationFeeRequest('wallet', TransferOperation.CoreSend, input)!
  harness.settled = request
  harness.effectKey = request.key
  harness.quote = {
    data: {key: request.key, maxKey: request.maxKey, fee: {feeCredits: null, feeDuffs: 1n, maxDuffs, maxPerTx: null, noteLimit: null}},
    loading: false,
    err: null,
  }
}

describe('Core fee refresh and allocation maximum', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    harness.cleanup = undefined
    settleQuote(params())
  })
  afterEach(() => {
    harness.cleanup?.()
    vi.useRealTimers()
  })

  it('retains the allocation maximum during slider debounce and fetch while the fee remains pending', () => {
    const next = params({amountDuffs: 75n, amountCredits: 75_000n})
    const debouncing = useOperationFee('wallet', TransferOperation.CoreSend, next)
    expect(debouncing.loading).toBe(true)
    expect(debouncing.maxDuffs).toBe(100n)
    expect(hasUnallocatedCoreFunds(75n, debouncing.maxDuffs)).toBe(true)
    vi.runAllTimers()
    harness.quote.loading = true
    const fetching = useOperationFee('wallet', TransferOperation.CoreSend, next)
    expect(fetching.loading).toBe(true)
    expect(fetching.maxDuffs).toBe(100n)
    settleQuote(next)
    expect(useOperationFee('wallet', TransferOperation.CoreSend, next)).toMatchObject({loading: false, maxDuffs: 100n})
  })

  it('detects a full allocation immediately without waiting for the refreshed fee', () => {
    const next = params({amountDuffs: 100n, amountCredits: 100_000n})
    const quote = useOperationFee('wallet', TransferOperation.CoreSend, next)
    expect(quote.loading).toBe(true)
    expect(hasUnallocatedCoreFunds(100n, quote.maxDuffs)).toBe(false)
    expect(hasUnallocatedCoreFunds(99n, quote.maxDuffs)).toBe(true)
  })

  it('invalidates the retained maximum immediately for a different wallet, source or output count', () => {
    expect(useOperationFee('other-wallet', TransferOperation.CoreSend, params()).maxDuffs).toBeNull()
    expect(useOperationFee('wallet', TransferOperation.CoreSend, params({coreSource: {kind: 'address', address: 'different-source'}})).maxDuffs).toBeNull()
    expect(useOperationFee('wallet', TransferOperation.CoreSend, params({recipient: ['', '']})).maxDuffs).toBeNull()
    expect(useOperationFee('wallet', null, params()).maxDuffs).toBeNull()
  })
})
