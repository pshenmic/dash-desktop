import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

const stub = vi.hoisted(() => ({
  fromHex: vi.fn(),
  getTransaction: vi.fn(),
  createAssetLockProof: vi.fn(),
}))

vi.mock('dash-core-sdk', () => ({
  DashCoreSDK: class { getTransaction = stub.getTransaction },
  InstantLock: {fromHex: vi.fn()},
  Transaction: {fromHex: stub.fromHex},
  utils: {createAssetLockProof: stub.createAssetLockProof},
}))

import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AssetLockDAO} from '../../src/main/src/database/AssetLockDAO'
import {AssetLockService} from '../../src/main/src/services/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/PlatformWorkerService'
import {AssetLockFundingState} from '../../src/main/src/types/AssetLockFunding'
import {AssetLockFundingRow, AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {AssetLockFundingStatus} from '../../src/main/src/enums/AssetLockFundingStatus'
import {Transaction} from '../../src/main/src/types/Transaction'

const WALLET = 'wallet-1'
const TXID = 'assetlock-txid'
const PREV_TXID = 'prev-txid'
const TX_HEX = 'deadbeef'

const row = (): AssetLockFundingRow => ({
  id: 1,
  walletId: WALLET,
  txid: TXID,
  outputIndex: 0,
  creditDerivationPath: "m/9'/1'/5'/1'/0",
  amountDuffs: 200_000n,
  toPlatformAddress: 'dest',
  kind: 'identity',
  status: AssetLockFundingStatus.L1Broadcast,
  stHash: null,
  error: null,
  identityIndex: 0,
  txHex: TX_HEX,
  assetLockProof: null,
  createdAt: 0,
})

const state = (): AssetLockFundingState => ({
  phase: 'waitingChainLock', kind: 'identity', txid: null, txHeight: null, chainLockedHeight: null,
  lockKind: null, stHash: null, toPlatformAddress: null, identityIdentifier: null,
  amountDuffs: null, error: null,
})

// One input, so a single prev-tx lookup decides whether the funding is dead.
const fundingTx = {
  hex: () => TX_HEX,
  inputs: [{txId: PREV_TXID, vOut: 3}],
}

// Whoever spent the outpoint this funding consumes. Empty string is what the
// local store maps an unspent output to.
const prevTx = (spentTxId: string): Transaction =>
  ({vout: [{n: 3, spentTxId}]}) as unknown as Transaction

type Funder = Record<string, ReturnType<typeof vi.fn>>

function wire(): {
  service: AssetLockService
  funder: Funder
  dao: Funder
  calls: string[]
} {
  const calls: string[] = []

  const funder: Funder = {
    buildAssetLock: vi.fn(async () => {
      calls.push('build')
      return {tx: fundingTx, txid: TXID, creditAddress: 'credit', creditDerivationPath: "m/9'/1'/5'/1'/0", inputAddresses: []}
    }),
    broadcastAssetLock: vi.fn(async () => { calls.push('broadcast') }),
    // An islock settles the proof race immediately. Every assertion here is
    // about what ran before it, and a race left unsettled spins on a real
    // wall-clock deadline.
    waitForInstantLock: vi.fn().mockResolvedValue('islock-hex'),
    waitForChainLock: vi.fn().mockResolvedValue(null),
    chainlockedHeight: vi.fn().mockReturnValue(0),
    getTxLockStatus: vi.fn().mockResolvedValue({instantLocked: false, chainlocked: false, confirmed: false}),
    getTransaction: vi.fn().mockResolvedValue(prevTx('')),
  }

  const dao: Funder = {
    insertFunding: vi.fn(async () => { calls.push('insert') }),
    deleteFunding: vi.fn(async () => { calls.push('delete') }),
    getActiveFunding: vi.fn().mockResolvedValue(row()),
    updateStatus: vi.fn(),
    saveProof: vi.fn(),
  }

  const service = new AssetLockService(
    {getWalletById: vi.fn().mockResolvedValue({walletId: WALLET, network: 'testnet'})} as unknown as WalletDAO,
    dao as unknown as AssetLockDAO,
    funder as unknown as AssetLockFunder,
    {request: vi.fn().mockResolvedValue({chain: {coreChainLockedHeight: 0}})} as unknown as PlatformWorkerService,
  )

  return {service, funder, dao, calls}
}

const acquire = (service: AssetLockService): Promise<unknown> => service.acquire(state(), {
  walletId: WALLET,
  kind: 'identity',
  destination: 'dest',
  amountDuffs: 200_000n,
  seed: new Uint8Array(64),
})

describe('recording an asset lock before broadcasting it', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stub.fromHex.mockReturnValue(fundingTx)
    // DAPI has never heard of it unless a case says otherwise.
    stub.getTransaction.mockReset()
    stub.getTransaction.mockResolvedValue(null)
    stub.createAssetLockProof.mockReturnValue({type: 'instantLock', instantLock: 'il', transaction: 'tx'})
  })

  afterEach(() => vi.restoreAllMocks())

  // The old order spent the coins first: anything failing before the insert
  // left a funding on chain that nothing could resume.
  it('writes the funding row before the transaction reaches the network', async () => {
    const {service, calls} = wire()

    await acquire(service).catch(() => undefined)

    expect(calls.indexOf('insert')).toBeLessThan(calls.indexOf('broadcast'))
  })

  it('spends nothing when the funding cannot be recorded', async () => {
    const {service, funder, dao} = wire()
    dao.insertFunding.mockRejectedValue(new Error('database is locked'))

    await expect(acquire(service)).rejects.toThrow('database is locked')

    expect(funder.broadcastAssetLock).not.toHaveBeenCalled()
  })

  // A row for a transaction the network refused would offer a resume that can
  // only time out.
  it('drops the row when the broadcast fails', async () => {
    const {service, funder, dao} = wire()
    funder.broadcastAssetLock.mockRejectedValue(new Error('no peers'))

    await expect(acquire(service)).rejects.toThrow('no peers')

    expect(dao.deleteFunding).toHaveBeenCalledWith(WALLET, TXID)
  })

  it('clears the txid off the state so a dropped funding is not resumable', async () => {
    const {service, funder} = wire()
    funder.broadcastAssetLock.mockRejectedValue(new Error('no peers'))
    const job = state()

    await expect(service.acquire(job, {
      walletId: WALLET, kind: 'identity', destination: 'dest', amountDuffs: 200_000n, seed: new Uint8Array(64),
    })).rejects.toThrow('no peers')

    expect(job.txid).toBeNull()
  })

  it('keeps the row once the broadcast succeeds', async () => {
    const {service, dao} = wire()

    await acquire(service).catch(() => undefined)

    expect(dao.deleteFunding).not.toHaveBeenCalled()
  })

  // A fresh acquire just put the transaction out; re-sending it would be noise.
  it('does not re-check the network for a funding it just broadcast', async () => {
    const {service, funder} = wire()

    await acquire(service).catch(() => undefined)

    expect(funder.getTxLockStatus).not.toHaveBeenCalled()
    expect(funder.broadcastAssetLock).toHaveBeenCalledTimes(1)
  })
})

describe('resuming a funding', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stub.fromHex.mockReturnValue(fundingTx)
    // DAPI has never heard of it unless a case says otherwise.
    stub.getTransaction.mockReset()
    stub.getTransaction.mockResolvedValue(null)
    stub.createAssetLockProof.mockReturnValue({type: 'instantLock', instantLock: 'il', transaction: 'tx'})
  })

  afterEach(() => vi.restoreAllMocks())

  const resume = (service: AssetLockService): Promise<unknown> => service.reacquire(state(), row())

  it('rebroadcasts when nothing shows the network ever took it', async () => {
    const {service, funder} = wire()

    await resume(service).catch(() => undefined)

    expect(funder.broadcastAssetLock).toHaveBeenCalledWith(TX_HEX)
  })

  // Presence in the local store proves nothing — recordOptimisticSpend writes
  // our own transaction at broadcast time — so only these three count.
  it.each([
    ['confirmed', {instantLocked: false, chainlocked: false, confirmed: true}],
    ['instant locked', {instantLocked: true, chainlocked: false, confirmed: false}],
    ['chainlocked', {instantLocked: false, chainlocked: true, confirmed: false}],
  ])('does not rebroadcast a funding that is already %s', async (_label, status) => {
    const {service, funder} = wire()
    funder.getTxLockStatus.mockResolvedValue(status)

    await resume(service).catch(() => undefined)

    expect(funder.broadcastAssetLock).not.toHaveBeenCalled()
  })

  // The wallet's own scan can be arbitrarily far behind the chain: it reported
  // no confirmation for a funding that already had four, and the resume spent
  // 30s pushing a mined transaction at peers that already held it.
  it('does not rebroadcast a funding DAPI can already see', async () => {
    const {service, funder} = wire()
    stub.getTransaction.mockResolvedValue({height: 1_535_567, isChainLocked: true})

    await resume(service).catch(() => undefined)

    expect(funder.broadcastAssetLock).not.toHaveBeenCalled()
  })

  it('rebroadcasts when DAPI cannot be reached either', async () => {
    const {service, funder} = wire()
    stub.getTransaction.mockRejectedValue(new Error('dapi unreachable'))

    await resume(service).catch(() => undefined)

    expect(funder.broadcastAssetLock).toHaveBeenCalledWith(TX_HEX)
  })

  it('refuses to wait for a funding whose inputs another transaction spent', async () => {
    const {service, funder} = wire()
    funder.getTransaction.mockResolvedValue(prevTx('some-other-txid'))

    await expect(resume(service)).rejects.toThrow(/already spent by some-other-txid/)
  })

  it('records the conflict so the funding stops being offered as active', async () => {
    const {service, funder, dao} = wire()
    funder.getTransaction.mockResolvedValue(prevTx('some-other-txid'))

    await resume(service).catch(() => undefined)

    expect(dao.updateStatus).toHaveBeenCalledWith(
      WALLET, TXID, AssetLockFundingStatus.Error, {error: expect.stringContaining('some-other-txid')},
    )
  })

  it('does not push a transaction it knows is dead', async () => {
    const {service, funder} = wire()
    funder.getTransaction.mockResolvedValue(prevTx('some-other-txid'))

    await resume(service).catch(() => undefined)

    expect(funder.broadcastAssetLock).not.toHaveBeenCalled()
  })

  // Our own optimistic spend records this funding as the spender. Reading that
  // as a conflict would kill every funding it resumed.
  it('does not mistake its own spend for a conflict', async () => {
    const {service, funder} = wire()
    funder.getTransaction.mockResolvedValue(prevTx(TXID))

    await resume(service).catch(() => undefined)

    expect(funder.broadcastAssetLock).toHaveBeenCalledWith(TX_HEX)
  })

  // A source that cannot say who spent an outpoint is not saying the funding is
  // dead, so the doubt has to resolve towards rebroadcasting.
  it('rebroadcasts when the spend cannot be checked', async () => {
    const {service, funder} = wire()
    funder.getTransaction.mockRejectedValue(new Error('indexer down'))

    await resume(service).catch(() => undefined)

    expect(funder.broadcastAssetLock).toHaveBeenCalledWith(TX_HEX)
  })

  // Peers holding the transaction never request it, so a rebroadcast of a live
  // funding reports no propagation — which must not end the resume.
  it('keeps waiting when the rebroadcast reports no propagation', async () => {
    const {service, funder} = wire()
    funder.broadcastAssetLock.mockRejectedValue(new Error('propagated to 0 peers'))

    await resume(service).catch(() => undefined)

    expect(funder.waitForInstantLock).toHaveBeenCalled()
  })

  // The stored proof short-circuits before any of this, so a settled funding
  // costs no network round trips on resume.
  it('checks nothing for a funding that already has its proof', async () => {
    const {service, funder} = wire()

    await service.reacquire(state(), {...row(), assetLockProof: {type: 'chainLock', coreChainLockedHeight: 10}})

    expect(funder.getTxLockStatus).not.toHaveBeenCalled()
    expect(funder.broadcastAssetLock).not.toHaveBeenCalled()
  })
})
