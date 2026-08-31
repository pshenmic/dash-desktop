import {describe, it, expect, vi} from 'vitest'
import {FeeService} from '../../src/main/src/services/wallet/FeeService'
import {PlatformAddressService} from '../../src/main/src/services/platform/PlatformAddressService'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {Preferences} from '../../src/main/src/preferences'
import {FeeOperation, FeeParams} from '../../src/main/platform/types/messages'
import {PlatformSourceCandidate} from '../../src/main/src/types/PlatformTransfer'
import {ShieldedSpendSource} from '../../src/main/src/types/ShieldedNoteSelection'
import {FeeQuoteParams} from '../../src/main/platform/types/messages'
import {Script} from 'dash-core-sdk'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {UTXO} from '../../src/main/src/types/UTXO'
import {ASSET_LOCK_PAYLOAD_BYTES} from '../../src/main/src/constants/chain'
import {coreFeeDuffsFor} from '../../src/main/src/utils/coreFeeRate'
import {
  DEFAULT_CORE_FEE_MULTIPLIER,
  DEFAULT_PLATFORM_FEE_MULTIPLIER,
  MIN_INPUT_CREDITS,
} from '../../src/main/src/constants/credits'

const WALLET = 'w1'
const IDENTITY = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'
const BASE_FEE = 1_000_000n
const CORE_ADDRESS = 'yPx8DNt1oQt3yubB2Sh73vAQRQ1AoyyLCS'
const ONE_DASH = 100_000_000n

const CORE_FEE = (inputsCount: number): bigint =>
  coreFeeDuffsFor(DEFAULT_CORE_FEE_MULTIPLIER, inputsCount, 1, true)
const ASSET_LOCK_FEE = (inputsCount: number): bigint =>
  coreFeeDuffsFor(DEFAULT_CORE_FEE_MULTIPLIER, inputsCount, 1, true, ASSET_LOCK_PAYLOAD_BYTES)

function utxo(satoshis: bigint, index: number): UTXO {
  return {address: CORE_ADDRESS, txId: `${index}`.padStart(64, '0'), vOut: 0, satoshis, script: new Script(), height: 1}
}

const outpoint = (index: number): {txid: string; vout: number} =>
  ({txid: `${index}`.padStart(64, '0'), vout: 0})

function candidate(platformAddress: string, balanceCredits: bigint, hashByte: number): PlatformSourceCandidate {
  const addressBytes = new Uint8Array(21)
  addressBytes[1] = hashByte
  return {platformAddress, addressBytes, index: 0, balanceCredits, nonce: 0}
}

function service(candidates: PlatformSourceCandidate[] = [], utxos: UTXO[] = []): {
  service: FeeService
  request: ReturnType<typeof vi.fn>
  estimateSpendFee: ReturnType<typeof vi.fn>
} {
  const request = vi.fn(async (kind: string) => (kind === 'addressInfos'
    ? {infos: candidates.map(c => ({address: c.platformAddress, balance: c.balanceCredits, nonce: c.nonce}))}
    : {feeCredits: BASE_FEE, metered: true}))
  const estimateSpendFee = vi.fn(async () => ({feeCredits: 7n, feeDuffs: null, maxDuffs: null, maxPerTx: 90n, noteLimit: 6}))
  const walletDAO = {
    getWalletById: vi.fn().mockResolvedValue({walletId: WALLET, network: 'testnet', platformXpub: 'xpub-test'}),
    getPlatformAddressCount: vi.fn().mockResolvedValue(candidates.length),
  }

  const addressDAO = {
    getAddressesByWalletId: async () => ({receiving: [{address: CORE_ADDRESS}], change: []}),
  }
  const providers = {forWallet: () => ({getWalletUtxos: async () => utxos})}

  const svc = new FeeService(
    walletDAO as unknown as WalletDAO,
    addressDAO as unknown as AddressDAO,
    {loadCandidates: async () => candidates} as unknown as PlatformAddressService,
    {request} as unknown as PlatformWorkerService,
    {estimateSpendFee} as unknown as ShieldedService,
    providers as unknown as WalletProviderFactory,
    Preferences.default(),
  )

  return {service: svc, request, estimateSpendFee}
}

function params(overrides: Partial<FeeParams> = {}): FeeParams {
  return {amountCredits: 1_000_000n, recipient: 'tdash1qrecipient', platformSource: null, identityId: IDENTITY, shieldedSource: null, ...overrides}
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
        {feeCredits: null, feeDuffs: null, maxDuffs: null, maxPerTx: null, noteLimit: null})
      expect(await svc.estimateFee(WALLET, operation, params({amountCredits: 0n}))).toEqual(
        {feeCredits: null, feeDuffs: null, maxDuffs: null, maxPerTx: null, noteLimit: null})
      expect(request).not.toHaveBeenCalled()
    }
  })

  // The operation name and the spend kind are the same word, so there is no
  // translation table left to get wrong.
  it('hands every pool spend to the shielded service under its own name', async () => {
    const operations: FeeOperation[] = ['shieldedTransfer', 'unshield', 'shieldedWithdrawal', 'identityCreateFromShielded']
    for (const operation of operations) {
      const {service: svc, estimateSpendFee} = service()
      const source: ShieldedSpendSource = {kind: 'address', noteIndexes: [2, 5]}
      const fee = await svc.estimateFee(WALLET, operation, params({shieldedSource: source}))
      expect(estimateSpendFee).toHaveBeenCalledWith(WALLET, operation, 1_000_000n, source)
      expect(fee).toEqual({feeCredits: 7n, feeDuffs: null, maxDuffs: null, maxPerTx: 90n, noteLimit: 6})
    }
  })

  // The L1 fee used to bypass this method and ride the status poll instead.
  it('prices a Core send in duffs, from the same method', async () => {
    const {service: svc, request} = service([], [utxo(ONE_DASH, 1)])
    expect(await svc.estimateFee(WALLET, 'coreSend', params({amountDuffs: 1_000n}))).toEqual({
      feeCredits: null,
      feeDuffs: CORE_FEE(1),
      maxDuffs: ONE_DASH - CORE_FEE(1),
      maxPerTx: null,
      noteLimit: null,
    })
    expect(request).not.toHaveBeenCalled()
  })

  // Quoting one input while the send signed however many the amount needed is
  // what let the fee shown and the fee charged disagree.
  it('prices a Core send for the inputs the amount actually takes', async () => {
    const utxos = [utxo(20_000n, 1), utxo(20_000n, 2), utxo(20_000n, 3)]
    const {service: svc} = service([], utxos)

    const fee = await svc.estimateFee(WALLET, 'coreSend', params({amountDuffs: 50_000n}))

    expect(fee.feeDuffs).toBe(CORE_FEE(3))
  })

  // Max offers this number, so a send of exactly it has to be one the selection
  // can still fund at the price it just quoted.
  it('offers a maximum the send can fund', async () => {
    const utxos = [utxo(20_000n, 1), utxo(20_000n, 2), utxo(20_000n, 3)]
    const {service: svc} = service([], utxos)

    const {maxDuffs} = await svc.estimateFee(WALLET, 'coreSend', params({amountDuffs: 0n}))
    const atMax = await svc.estimateFee(WALLET, 'coreSend', params({amountDuffs: maxDuffs}))

    expect(maxDuffs).toBe(60_000n - CORE_FEE(3))
    expect(maxDuffs! + atMax.feeDuffs!).toBe(60_000n)
  })

  // An amount nothing can fund still has to answer, because the quote runs
  // while the user is still typing one.
  it('falls back to the one-input floor for an amount the selection refuses', async () => {
    const {service: svc} = service([], [utxo(20_000n, 1)])

    const fee = await svc.estimateFee(WALLET, 'coreSend', params({amountDuffs: 900_000n}))

    expect(fee.feeDuffs).toBe(CORE_FEE(1))
    expect(fee.maxDuffs).toBe(20_000n - CORE_FEE(1))
  })

  // A picked set is spent whole, so the quote cannot price the prefix the
  // automatic selection would have stopped at.
  it('prices a Core send for every coin the user picked', async () => {
    const utxos = [utxo(20_000n, 1), utxo(20_000n, 2), utxo(20_000n, 3)]
    const {service: svc} = service([], utxos)

    const fee = await svc.estimateFee(WALLET, 'coreSend', params({
      amountDuffs: 1_000n,
      coreSource: {kind: 'outpoints', outpoints: [outpoint(1), outpoint(2)]},
    }))

    expect(fee.feeDuffs).toBe(CORE_FEE(2))
    expect(fee.maxDuffs).toBe(40_000n - CORE_FEE(2))
  })

  // The same amount over the same wallet, priced for one input, is what the
  // automatic selection answers — the pick is what makes the difference.
  it('prices a picked set apart from what the automatic selection would take', async () => {
    const utxos = [utxo(20_000n, 1), utxo(20_000n, 2), utxo(20_000n, 3)]
    const {service: svc} = service([], utxos)

    const auto = await svc.estimateFee(WALLET, 'coreSend', params({amountDuffs: 1_000n}))

    expect(auto.feeDuffs).toBe(CORE_FEE(1))
    expect(auto.maxDuffs).toBe(60_000n - CORE_FEE(3))
  })

  // The pick decides the input count, so an amount nothing can fund is still
  // priced for the coins that would go in rather than a one-input floor.
  it('holds the picked count for an amount the pick cannot cover', async () => {
    const utxos = [utxo(20_000n, 1), utxo(20_000n, 2)]
    const {service: svc} = service([], utxos)

    const fee = await svc.estimateFee(WALLET, 'coreSend', params({
      amountDuffs: 900_000n,
      coreSource: {kind: 'outpoints', outpoints: [outpoint(1), outpoint(2)]},
    }))

    expect(fee.feeDuffs).toBe(CORE_FEE(2))
  })

  // An asset lock is funded by L1 coins, so a platform address names nothing it
  // could spend — refused rather than ignored.
  it('refuses a platform input pick on an asset lock', async () => {
    const {service: svc} = service([], [utxo(ONE_DASH, 1)])

    await expect(svc.estimateFee(WALLET, 'identityRegister', params({
      amountDuffs: 1_000n,
      platformSource: {kind: 'address', address: 'tdash1qsourceplatformaddress'},
    }))).rejects.toThrow('address-funded operations only')
  })

  // An asset lock is funded by L1 coins like any other send, and the link it
  // writes between them and its L2 destination is the reason to choose them.
  it('prices an asset lock for the coins the user picked', async () => {
    for (const operation of ['assetLockFunding', 'assetLockShield', 'identityRegister', 'identityTopUpL1'] as FeeOperation[]) {
      const utxos = [utxo(20_000_000n, 1), utxo(20_000_000n, 2), utxo(20_000_000n, 3)]
      const {service: svc} = service([], utxos)

      const fee = await svc.estimateFee(WALLET, operation, params({
        amountDuffs: 1_000n,
        coreSource: {kind: 'outpoints', outpoints: [outpoint(1), outpoint(2)]},
      }))

      expect(fee.feeDuffs).toBe(ASSET_LOCK_FEE(2))
      expect(fee.maxDuffs).toBe(40_000_000n - ASSET_LOCK_FEE(2))
    }
  })

  // A pick names L1 coins, so an operation funded by platform credits, an
  // identity balance or the pool has nothing to apply it to.
  it('refuses to price an L2-funded operation from a picked set', async () => {
    for (const operation of ['identityCreate', 'identityWithdrawal', 'shield', 'shieldedTransfer'] as FeeOperation[]) {
      const {service: svc} = service([candidate('tdash1qsource', 10_000_000n, 1)], [utxo(ONE_DASH, 1)])

      await expect(svc.estimateFee(WALLET, operation, params({
        coreSource: {kind: 'outpoints', outpoints: [outpoint(1)]},
      }))).rejects.toThrow('L1-funded operations only')
    }
  })

  // An L1 -> L2 transfer is two transactions, and quoting only the lock left the
  // transition its proof funds unpriced.
  it('prices both halves of a transfer that locks on L1 and settles on L2', async () => {
    for (const operation of ['assetLockFunding', 'assetLockShield', 'identityRegister', 'identityTopUpL1'] as FeeOperation[]) {
      const {service: svc, request} = service([], [utxo(ONE_DASH, 1)])
      expect(await svc.estimateFee(WALLET, operation, params({amountDuffs: 1_000n}))).toEqual({
        feeCredits: BASE_FEE * BigInt(DEFAULT_PLATFORM_FEE_MULTIPLIER),
        feeDuffs: ASSET_LOCK_FEE(1),
        maxDuffs: ONE_DASH - ASSET_LOCK_FEE(1),
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
