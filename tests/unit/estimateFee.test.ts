import {describe, it, expect, vi} from 'vitest'
import {FeeService} from '../../src/main/src/services/wallet/FeeService'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {Preferences} from '../../src/main/src/preferences'
import {FeeOperation, FeeParams} from '../../src/main/platform/types/messages'
import {PlatformSourceCandidate} from '../../src/main/src/types/PlatformTransfer'
import {FeeQuoteParams} from '../../src/main/platform/types/messages'
import {CORE_TRANSFER_FEE_DUFFS, DEFAULT_CORE_FEE_MULTIPLIER, DEFAULT_PLATFORM_FEE_MULTIPLIER, MIN_INPUT_CREDITS} from '../../src/main/src/constants'

const WALLET = 'w1'
const IDENTITY = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'
const BASE_FEE = 1_000_000n

function candidate(platformAddress: string, balanceCredits: bigint, hashByte: number): PlatformSourceCandidate {
  const addressBytes = new Uint8Array(21)
  addressBytes[1] = hashByte
  return {platformAddress, addressBytes, index: 0, balanceCredits, nonce: 0}
}

function service(candidates: PlatformSourceCandidate[] = []): {
  service: FeeService
  request: ReturnType<typeof vi.fn>
  estimateSpendFee: ReturnType<typeof vi.fn>
} {
  const request = vi.fn(async (kind: string) => (kind === 'addressInfos'
    ? {infos: candidates.map(c => ({address: c.platformAddress, balance: c.balanceCredits, nonce: c.nonce}))}
    : {feeCredits: BASE_FEE, metered: true}))
  const estimateSpendFee = vi.fn(async () => ({feeCredits: 7n, feeDuffs: null, maxPerTx: 90n, noteLimit: 6}))
  const walletDAO = {
    getWalletById: vi.fn().mockResolvedValue({walletId: WALLET, network: 'testnet', platformXpub: 'xpub-test'}),
    getPlatformAddressCount: vi.fn().mockResolvedValue(candidates.length),
  }

  const svc = new FeeService(
    walletDAO as unknown as WalletDAO,
    {request} as unknown as PlatformWorkerService,
    {estimateSpendFee} as unknown as ShieldedService,
    Preferences.default(),
  )
  ;(svc as unknown as {loadCandidates: unknown}).loadCandidates = async () => candidates

  return {service: svc, request, estimateSpendFee}
}

function params(overrides: Partial<FeeParams> = {}): FeeParams {
  return {amountCredits: 1_000_000n, recipient: 'tdash1qrecipient', sourceAddress: null, identityId: IDENTITY, noteIndexes: null, ...overrides}
}

function feeCalls(request: ReturnType<typeof vi.fn>): Array<{operation: string; params: FeeQuoteParams}> {
  return request.mock.calls
    .filter(call => call[0] === 'transitionFee')
    .map(call => call[2] as {operation: string; params: FeeQuoteParams})
}

describe('estimateFee', () => {
  // Main decides which operations the worker prices and at what input count;
  // what each one costs is the worker's switch, tested through it.
  it('sends the operation and the params straight through, with no query in between', async () => {
    const {service: svc, request} = service()
    await svc.estimateFee(WALLET, 'addressFundsTransfer', params())
    expect(feeCalls(request)[0]).toEqual({
      operation: 'addressFundsTransfer',
      params: {...params(), inputCount: 1, coreFeePerByte: 1},
    })
  })

  it('asks the worker under the same name the renderer used', async () => {
    const operations: FeeOperation[] = [
      'addressFundsTransfer', 'addressWithdrawal', 'shield',
      'identityToAddress', 'identityToIdentity', 'identityWithdrawal',
      'identityCreate', 'identityTopUp',
    ]
    for (const operation of operations) {
      const {service: svc, request} = service()
      await svc.estimateFee(WALLET, operation, params())
      expect(feeCalls(request)[0].operation).toBe(operation)
    }
  })

  // The whole point of routing this through the backend: the fee scales with
  // the input count, which only the selection knows.
  it('re-prices at the input count the selection actually takes', async () => {
    const spread = [candidate('a', 9_000_000n, 1), candidate('b', 5_000_000n, 2)]
    const {service: svc, request} = service(spread)
    await svc.estimateFee(WALLET, 'identityCreate', params({amountCredits: 6_000_000n}))
    expect(feeCalls(request).map(call => call.params.inputCount)).toEqual([1, 2])
  })

  it('falls back to the one-input floor when no selection can be funded', async () => {
    const {service: svc, request} = service([candidate('a', MIN_INPUT_CREDITS, 1)])
    const fee = await svc.estimateFee(WALLET, 'addressWithdrawal', params({amountCredits: 900_000_000n}))
    expect(fee.feeCredits).toBe(BASE_FEE * BigInt(DEFAULT_PLATFORM_FEE_MULTIPLIER))
    expect(feeCalls(request).at(-1)!.params.inputCount).toBe(1)
  })

  // Each extra output costs the same again, so a send paying several must not
  // be priced as if it paid one.
  it('passes every recipient an operation pays, not just the first', async () => {
    const {service: svc, request} = service()
    const addresses = ['a', 'b', 'c']
    await svc.estimateFee(WALLET, 'identityToAddress', params({recipient: addresses}))
    expect(feeCalls(request)[0].params.recipient).toEqual(addresses)
  })

  it('supplies the Core rate the multiplier snapped to, which the worker cannot read', async () => {
    const {service: svc, request} = service()
    await svc.estimateFee(WALLET, 'identityWithdrawal', params())
    expect(feeCalls(request)[0].params.coreFeePerByte).toBe(1)
  })

  it('cannot price an identity transition before the identity or amount is known', async () => {
    for (const operation of ['identityToAddress', 'identityToIdentity', 'identityWithdrawal'] as FeeOperation[]) {
      const {service: svc, request} = service()
      expect(await svc.estimateFee(WALLET, operation, params({identityId: null}))).toEqual(
        {feeCredits: null, feeDuffs: null, maxPerTx: null, noteLimit: null})
      expect(await svc.estimateFee(WALLET, operation, params({amountCredits: 0n}))).toEqual(
        {feeCredits: null, feeDuffs: null, maxPerTx: null, noteLimit: null})
      expect(request).not.toHaveBeenCalled()
    }
  })

  // The operation name and the spend kind are the same word, so there is no
  // translation table left to get wrong.
  it('hands every pool spend to the shielded service under its own name', async () => {
    const operations: FeeOperation[] = ['shieldedTransfer', 'unshield', 'shieldedWithdrawal', 'identityCreateFromShielded']
    for (const operation of operations) {
      const {service: svc, estimateSpendFee} = service()
      const fee = await svc.estimateFee(WALLET, operation, params({noteIndexes: [2, 5]}))
      expect(estimateSpendFee).toHaveBeenCalledWith(WALLET, operation, 1_000_000n, [2, 5])
      expect(fee).toEqual({feeCredits: 7n, feeDuffs: null, maxPerTx: 90n, noteLimit: 6})
    }
  })

  // The L1 fee used to bypass this method and ride the status poll instead.
  it('prices a Core send in duffs, from the same method', async () => {
    const {service: svc, request} = service()
    expect(await svc.estimateFee(WALLET, 'coreSend', params())).toEqual({
      feeCredits: null,
      feeDuffs: CORE_TRANSFER_FEE_DUFFS * BigInt(DEFAULT_CORE_FEE_MULTIPLIER),
      maxPerTx: null,
      noteLimit: null,
    })
    expect(request).not.toHaveBeenCalled()
  })

  // An L1 -> L2 transfer is two transactions, and quoting only the lock left the
  // transition its proof funds unpriced.
  it('prices both halves of a transfer that locks on L1 and settles on L2', async () => {
    for (const operation of ['assetLockFunding', 'assetLockShield', 'identityRegister', 'identityTopUpL1'] as FeeOperation[]) {
      const {service: svc, request} = service()
      expect(await svc.estimateFee(WALLET, operation, params())).toEqual({
        feeCredits: BASE_FEE * BigInt(DEFAULT_PLATFORM_FEE_MULTIPLIER),
        feeDuffs: CORE_TRANSFER_FEE_DUFFS * BigInt(DEFAULT_CORE_FEE_MULTIPLIER),
        maxPerTx: null,
        noteLimit: null,
      })
      expect(feeCalls(request)[0].operation, operation).toBe(operation)
      expect(feeCalls(request)[0].params.inputCount, operation).toBe(1)
    }
  })

  it('applies the platform fee multiplier to a metered quote', async () => {
    const {service: svc} = service()
    const fee = await svc.estimateFee(WALLET, 'addressFundsTransfer', params())
    expect(fee.feeCredits).toBe(BASE_FEE * BigInt(DEFAULT_PLATFORM_FEE_MULTIPLIER))
  })

  // requireFee is what the send paths call, so it must refuse what a quote may
  // legitimately answer.
  it('refuses to hand a send an unpriced fee', async () => {
    const {service: svc} = service()
    await expect(svc.requireFee(WALLET, 'identityToIdentity', params({identityId: null})))
      .rejects.toThrow(/Could not price/)
  })
})
