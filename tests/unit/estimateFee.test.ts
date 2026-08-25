import {describe, it, expect, vi} from 'vitest'
import {FeeService} from '../../src/main/src/services/wallet/FeeService'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {Preferences} from '../../src/main/src/preferences'
import {FeeOperation, FeeParams} from '../../src/main/src/types/Fee'
import {PlatformSourceCandidate} from '../../src/main/src/types/PlatformTransfer'
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

function feeCalls(request: ReturnType<typeof vi.fn>): Array<{kind: string; inputCount?: number}> {
  return request.mock.calls
    .filter(call => call[0] === 'transitionFee')
    .map(call => (call[2] as {query: {kind: string; inputCount?: number}}).query)
}

function queryOf(request: ReturnType<typeof vi.fn>, call = 0): unknown {
  return feeCalls(request)[call]
}

describe('estimateFee', () => {
  it('prices an address transfer as one input to one recipient', async () => {
    const {service: svc, request} = service()
    await svc.estimateFee(WALLET, 'addressFundsTransfer', params())
    expect(queryOf(request)).toEqual({kind: 'addressTransfer', inputCount: 1})
  })

  it('prices a withdrawal without a change output', async () => {
    const {service: svc, request} = service()
    await svc.estimateFee(WALLET, 'addressWithdrawal', params())
    expect(queryOf(request)).toEqual({kind: 'addressWithdrawal', inputCount: 1})
  })

  // The whole point of routing this through the backend: the fee scales with
  // the input count, which only the selection knows.
  it('re-prices at the input count the selection actually takes', async () => {
    const spread = [candidate('a', 9_000_000n, 1), candidate('b', 5_000_000n, 2)]
    const {service: svc, request} = service(spread)
    await svc.estimateFee(WALLET, 'identityCreate', params({amountCredits: 6_000_000n}))
    expect(feeCalls(request).map(query => query.inputCount)).toEqual([1, 2])
  })

  it('falls back to the one-input floor when no selection can be funded', async () => {
    const {service: svc, request} = service([candidate('a', MIN_INPUT_CREDITS, 1)])
    const fee = await svc.estimateFee(WALLET, 'addressWithdrawal', params({amountCredits: 900_000_000n}))
    expect(fee.feeCredits).toBe(BASE_FEE * BigInt(DEFAULT_PLATFORM_FEE_MULTIPLIER))
    expect(queryOf(request, feeCalls(request).length - 1)).toEqual({kind: 'addressWithdrawal', inputCount: 1})
  })

  it('carries the identity a top-up funds', async () => {
    const {service: svc, request} = service()
    await svc.estimateFee(WALLET, 'identityTopUp', params({recipient: IDENTITY}))
    expect(queryOf(request)).toEqual({kind: 'identityTopUpFromAddresses', identityId: IDENTITY, inputCount: 1})
  })

  it('prices a shield as a single pool note', async () => {
    const {service: svc, request} = service()
    await svc.estimateFee(WALLET, 'shield', params())
    expect(queryOf(request)).toEqual({kind: 'shield'})
  })

  it('prices the three identity-funded transitions from the identity', async () => {
    for (const [operation, expected] of [
      ['identityToAddress', {kind: 'identityCreditsToAddresses', identityId: IDENTITY, recipients: [{address: 'tdash1qrecipient', amountCredits: 1_000_000n}]}],
      ['identityToIdentity', {kind: 'identityCreditTransfer', identityId: IDENTITY, recipientId: 'tdash1qrecipient', amountCredits: 1_000_000n}],
      ['identityWithdrawal', {kind: 'identityWithdrawal', identityId: IDENTITY, amountCredits: 1_000_000n, coreAddress: 'tdash1qrecipient', coreFeePerByte: 1}],
    ] as Array<[FeeOperation, unknown]>) {
      const {service: svc, request} = service()
      await svc.estimateFee(WALLET, operation, params())
      expect(queryOf(request)).toEqual(expected)
    }
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

  it('hands every pool spend to the shielded service with its spend kind', async () => {
    const kinds: Array<[FeeOperation, string]> = [
      ['shieldedTransfer', 'transfer'],
      ['unshield', 'unshield'],
      ['shieldedWithdrawal', 'withdrawal'],
      ['identityCreateFromPool', 'identityCreate'],
    ]
    for (const [operation, spendKind] of kinds) {
      const {service: svc, estimateSpendFee} = service()
      const fee = await svc.estimateFee(WALLET, operation, params({noteIndexes: [2, 5]}))
      expect(estimateSpendFee).toHaveBeenCalledWith(WALLET, spendKind, 1_000_000n, [2, 5])
      expect(fee).toEqual({feeCredits: 7n, feeDuffs: null, maxPerTx: 90n, noteLimit: 6})
    }
  })

  // The L1 fee used to bypass this method and ride the status poll instead.
  it('prices the operations paid in Dash in duffs, from the same method', async () => {
    for (const operation of ['coreSend', 'assetLockFunding', 'assetLockShield', 'identityRegister', 'identityTopUpL1'] as FeeOperation[]) {
      const {service: svc, request} = service()
      expect(await svc.estimateFee(WALLET, operation, params())).toEqual({
        feeCredits: null,
        feeDuffs: CORE_TRANSFER_FEE_DUFFS * BigInt(DEFAULT_CORE_FEE_MULTIPLIER),
        maxPerTx: null,
        noteLimit: null,
      })
      expect(request).not.toHaveBeenCalled()
    }
  })

  it('applies the platform fee multiplier to a metered quote', async () => {
    const {service: svc} = service()
    const fee = await svc.estimateFee(WALLET, 'addressFundsTransfer', params())
    expect(fee.feeCredits).toBe(BASE_FEE * BigInt(DEFAULT_PLATFORM_FEE_MULTIPLIER))
  })
})
