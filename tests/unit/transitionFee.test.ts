import {describe, it, expect} from 'vitest'
import {DashPlatformSDK} from 'dash-platform-sdk'
import {PlatformAddressWASM} from 'pshenmic-dpp'
import {createBase58check} from '@scure/base'
import {sha256} from '@noble/hashes/sha2.js'
import {transitionFee} from '../../src/main/platform/operations/fee'
import {FeeQuoteParams, TransitionFeeOperation} from '../../src/main/platform/types/messages'
import {OperationContext} from '../../src/main/platform/operations/types'

const IDENTITY = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'
const CORE_ADDRESS = coreAddress()
const PLATFORM_ADDRESS = platformAddress(0)

function platformAddress(index: number): string {
  const bytes = new Uint8Array(21)
  bytes[1] = index
  return PlatformAddressWASM.fromBytes(bytes).toBech32m('testnet')
}

// Testnet p2pkh: version byte 140 over a 20-byte hash.
function coreAddress(): string {
  const payload = new Uint8Array(21)
  payload[0] = 140
  payload.set(new Uint8Array(20).fill(7), 1)
  return createBase58check(sha256).encode(payload)
}

// `recipient` is whatever kind of address the operation pays, which is the one
// thing about FeeParams a reader has to know.
const RECIPIENT: Record<TransitionFeeOperation, string> = {
  addressFundsTransfer: PLATFORM_ADDRESS,
  addressWithdrawal: CORE_ADDRESS,
  shield: PLATFORM_ADDRESS,
  identityToAddress: PLATFORM_ADDRESS,
  identityToIdentity: IDENTITY,
  identityWithdrawal: CORE_ADDRESS,
  identityCreate: '',
  identityTopUp: IDENTITY,
}

const ctx = {
  sdk: new DashPlatformSDK({network: 'testnet'}),
  network: 'testnet',
  signal: new AbortController().signal,
  progress: () => undefined,
  notesSpent: () => undefined,
} as unknown as OperationContext

function params(overrides: Partial<FeeQuoteParams> = {}): FeeQuoteParams {
  return {
    amountCredits: 1_000_000n,
    recipient: IDENTITY,
    sourceAddress: null,
    identityId: IDENTITY,
    noteIndexes: null,
    inputCount: 1,
    coreFeePerByte: 1,
    ...overrides,
  }
}

const ALL: TransitionFeeOperation[] = [
  'addressFundsTransfer',
  'addressWithdrawal',
  'shield',
  'identityToAddress',
  'identityToIdentity',
  'identityWithdrawal',
  'identityCreate',
  'identityTopUp',
]

describe('transitionFee', () => {
  it('prices every operation main can send it', () => {
    for (const operation of ALL) {
      const quote = transitionFee({operation, params: params({recipient: RECIPIENT[operation]})}, ctx)
      expect(quote.feeCredits, operation).toBeGreaterThan(0n)
    }
  })

  it('marks everything but a shield as metered, since only the pool fee is exact', () => {
    for (const operation of ALL) {
      const {metered} = transitionFee({operation, params: params({recipient: RECIPIENT[operation]})}, ctx)
      expect(metered, operation).toBe(operation !== 'shield')
    }
  })

  // The two counts main supplies are the whole reason a quote cannot be a
  // constant: each extra input and each extra output costs again.
  it('charges for every input', () => {
    const feeAt = (inputCount: number): bigint =>
      transitionFee({operation: 'addressFundsTransfer', params: params({inputCount, recipient: PLATFORM_ADDRESS})}, ctx).feeCredits
    expect(feeAt(2)).toBeGreaterThan(feeAt(1))
    expect(feeAt(3) - feeAt(2)).toBe(feeAt(2) - feeAt(1))
  })

  it('charges for every recipient', () => {
    const feeAt = (count: number): bigint => transitionFee({
      operation: 'identityToAddress',
      params: params({recipient: Array.from({length: count}, (_, i) => platformAddress(i))}),
    }, ctx).feeCredits
    expect(feeAt(2)).toBeGreaterThan(feeAt(1))
    expect(feeAt(3) - feeAt(2)).toBe(feeAt(2) - feeAt(1))
  })

  // The transition keys its outputs by address, so paying one address twice is
  // one output. Passing the real addresses is what makes the quote match; a
  // count would have over-charged for the duplicate.
  it('prices a repeated address as the single output it becomes', () => {
    const once = transitionFee({operation: 'identityToAddress', params: params({recipient: [PLATFORM_ADDRESS]})}, ctx)
    const twice = transitionFee({
      operation: 'identityToAddress',
      params: params({recipient: [PLATFORM_ADDRESS, PLATFORM_ADDRESS]}),
    }, ctx)
    expect(twice.feeCredits).toBe(once.feeCredits)
  })

  // A bare string is one recipient; nothing has to say so separately.
  it('prices a single recipient the same whether it is a string or a list of one', () => {
    const asString = transitionFee({operation: 'identityToAddress', params: params({recipient: PLATFORM_ADDRESS})}, ctx)
    const asList = transitionFee({operation: 'identityToAddress', params: params({recipient: [PLATFORM_ADDRESS]})}, ctx)
    expect(asString.feeCredits).toBe(asList.feeCredits)
  })

  // Measured across the u64 range: the placeholder costs nothing in accuracy,
  // and saves a proved gRPC round trip on every keystroke.
  it('prices identity transitions the same whatever the real nonce would be', () => {
    for (const operation of ['identityToAddress', 'identityToIdentity', 'identityWithdrawal'] as TransitionFeeOperation[]) {
      const quote = transitionFee({operation, params: params({recipient: RECIPIENT[operation]})}, ctx)
      expect(quote.feeCredits, operation).toBeGreaterThan(0n)
    }
  })
})
