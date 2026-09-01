import {describe, it, expect, vi} from 'vitest'

vi.mock('pshenmic-dpp', () => ({
  OrchardAddressWASM: {fromBech32m: (address: string) => ({address})},
  ShieldedMemoWASM: {empty: () => ({memo: 'empty'})},
  ShieldedOutputWASM: class {
    constructor(public address: {address: string}, public amount: bigint, public memo: unknown) {}
  },
}))

// Key derivation is the identity path's own concern, and needs a real seed.
vi.mock('../../src/main/platform/operations/shielded/spend/identityKeys', () => ({
  identityKeys: () => ({publicKeys: [], privateKeys: []}),
}))

import {DashPlatformSDK} from 'dash-platform-sdk'
import {buildTransition} from '../../src/main/platform/operations/shielded/spend/buildTransition'
import {spend} from '../../src/main/platform/operations/shielded/spend/spend'
import {OperationContext} from '../../src/main/platform/operations/types'
import {PlatformOperations} from '../../src/main/platform/types/messages'
import {MAX_SPEND_RECIPIENTS} from '../../src/main/src/constants/credits'

type Payload = PlatformOperations['spend']['payload']

const ANCHOR = new Uint8Array(32).fill(1)
const SEED = new Uint8Array(64).fill(7)
const CHANGE = {address: 'change'} as never

function sdkStub(): {
  sdk: DashPlatformSDK
  createStateTransition: ReturnType<typeof vi.fn>
  shieldedTransferMulti: ReturnType<typeof vi.fn>
} {
  const createStateTransition = vi.fn(async () => 'single-transition')
  const shieldedTransferMulti = vi.fn(async () => ({stateTransition: 'multi-transition', fee: 6n}))
  const sdk = {
    shielded: {
      createStateTransition,
      getShieldedBuilder: async () => ({shieldedTransferMulti}),
    },
  } as unknown as DashPlatformSDK
  return {sdk, createStateTransition, shieldedTransferMulti}
}

const payload = (overrides: Partial<Payload>): Payload => ({
  seed: SEED,
  kind: 'shieldedTransfer',
  recipients: [{address: 'addr-a', amountCredits: 1_000n}],
  amountCredits: 1_000n,
  notes: [],
  source: null,
  identityIndex: null,
  failureAddress: null,
  coreFeePerByte: 1,
  ...overrides,
})

describe('building a shielded spend transition', () => {
  // The bundle builder is the only one that fans out, and reaching it through
  // the SDK's flat transition map is not possible.
  it('pays several recipients through the bundle builder', async () => {
    const {sdk, createStateTransition, shieldedTransferMulti} = sdkStub()

    const transition = await buildTransition(sdk, 'testnet', payload({
      recipients: [
        {address: 'addr-a', amountCredits: 1_000n},
        {address: 'addr-b', amountCredits: 2_500n},
      ],
      amountCredits: 3_500n,
    }), [], ANCHOR, CHANGE)

    expect(transition).toBe('multi-transition')
    expect(createStateTransition).not.toHaveBeenCalled()

    const outputs = shieldedTransferMulti.mock.calls[0][1]
    expect(outputs.map((output: {address: {address: string}; amount: bigint}) =>
      [output.address.address, output.amount])).toEqual([['addr-a', 1_000n], ['addr-b', 2_500n]])
  })

  // The amounts are the caller's to choose: nothing here splits a total, so two
  // recipients of different sizes stay different sizes.
  it('pays each recipient the amount it was given', async () => {
    const {sdk, shieldedTransferMulti} = sdkStub()

    await buildTransition(sdk, 'testnet', payload({
      recipients: [
        {address: 'addr-a', amountCredits: 9n},
        {address: 'addr-b', amountCredits: 1n},
        {address: 'addr-c', amountCredits: 90n},
      ],
      amountCredits: 100n,
    }), [], ANCHOR, CHANGE)

    const outputs = shieldedTransferMulti.mock.calls[0][1]
    expect(outputs.map((output: {amount: bigint}) => output.amount)).toEqual([9n, 1n, 90n])
  })

  it('keeps a single recipient on the transition the SDK exposes', async () => {
    const {sdk, createStateTransition, shieldedTransferMulti} = sdkStub()

    const transition = await buildTransition(sdk, 'testnet', payload({}), [], ANCHOR, CHANGE)

    expect(transition).toBe('single-transition')
    expect(shieldedTransferMulti).not.toHaveBeenCalled()
    expect(createStateTransition).toHaveBeenCalledWith('shieldedTransfer', expect.objectContaining({
      transferAmount: 1_000n,
    }))
  })

  // amountCredits is what leaves the pool, which a fee-bearing kind can exceed
  // its payout by; taking an output amount from it would overpay the recipient.
  it('takes a payout from its own recipient rather than the pool total', async () => {
    const {sdk, createStateTransition} = sdkStub()

    await buildTransition(sdk, 'testnet', payload({
      kind: 'unshield',
      recipients: [{address: 'addr-a', amountCredits: 1_000n}],
      amountCredits: 9_999n,
    }), [], ANCHOR, CHANGE)

    expect(createStateTransition).toHaveBeenCalledWith('unshield', expect.objectContaining({
      unshieldAmount: 1_000n,
    }))
  })

  // The one kind that pays no address funds itself from the pool total.
  it('funds an identity from the amount rather than a recipient', async () => {
    const {sdk, createStateTransition} = sdkStub()

    await buildTransition(sdk, 'testnet', payload({
      kind: 'identityCreateFromShielded',
      recipients: [],
      amountCredits: 40_000n,
      identityIndex: 0,
      failureAddress: 'refund-addr',
    }), [], ANCHOR, CHANGE)

    expect(createStateTransition).toHaveBeenCalledWith('identityCreateFromShieldedPool', expect.objectContaining({
      denomination: 40_000n,
    }))
  })
})

// The guard runs before the notes are recovered, so a refused payload costs no
// round trip and no proof.
describe('the recipients a spend payload may carry', () => {
  const context = (): OperationContext => ({
    sdk: {} as DashPlatformSDK,
    network: 'testnet',
    signal: new AbortController().signal,
    progress: () => undefined,
    notesSpent: () => undefined,
  } as unknown as OperationContext)

  it('refuses a transfer that names nobody', async () => {
    await expect(spend(payload({recipients: [], amountCredits: 100n}), context()))
      .rejects.toThrow(/shieldedTransfer takes/)
  })

  it('refuses a payout that names more than one address', async () => {
    for (const kind of ['unshield', 'shieldedWithdrawal'] as const) {
      await expect(spend(payload({
        kind,
        recipients: [{address: 'a', amountCredits: 1n}, {address: 'b', amountCredits: 1n}],
        amountCredits: 2n,
      }), context())).rejects.toThrow(/takes 1 recipients at most/)
    }
  })

  it('refuses an identity create that names an address', async () => {
    await expect(spend(payload({
      kind: 'identityCreateFromShielded',
      recipients: [{address: 'a', amountCredits: 1n}],
      amountCredits: 100n,
    }), context())).rejects.toThrow(/takes 0 recipients at most/)
  })

  it('refuses a transfer past the action cap', async () => {
    const many = Array.from({length: MAX_SPEND_RECIPIENTS + 1}, (_, i) =>
      ({address: `addr-${i}`, amountCredits: 1n}))
    await expect(spend(payload({recipients: many, amountCredits: BigInt(many.length)}), context()))
      .rejects.toThrow(new RegExp(`takes ${MAX_SPEND_RECIPIENTS} recipients at most`))
  })
})
