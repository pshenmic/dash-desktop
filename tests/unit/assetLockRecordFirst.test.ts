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
import {AssetLockService} from '../../src/main/src/services/platform/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {AssetLockFundingState} from '../../src/main/src/types/AssetLockFunding'
import {AssetLockFundingRow, AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {AssetLockFundingStatus} from '../../src/main/src/enums/AssetLockFundingStatus'

const WALLET = 'wallet-1'
const TXID = 'assetlock-txid'
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

const fundingTx = {hex: () => TX_HEX}

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
    // An islock settles the proof race immediately; a race left unsettled spins
    // on a real wall-clock deadline.
    waitForInstantLock: vi.fn().mockResolvedValue('islock-hex'),
    waitForChainLock: vi.fn().mockResolvedValue(null),
    chainlockedHeight: vi.fn().mockReturnValue(0),
  }

  const dao: Funder = {
    insertFunding: vi.fn(async () => { calls.push('insert') }),
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
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stub.fromHex.mockReturnValue(fundingTx)
    // DAPI has never heard of it unless a case says otherwise.
    stub.getTransaction.mockReset()
    stub.getTransaction.mockResolvedValue(null)
    stub.createAssetLockProof.mockReturnValue({type: 'instantLock', instantLock: 'il', transaction: 'tx'})
  })

  afterEach(() => vi.restoreAllMocks())

  // Coins committed before the row exists cannot be resumed, so the insert has
  // to precede the broadcast.
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

  // A failed response is ambiguous: peers may have received the transaction
  // before the transport disappeared, so the signed funding must stay resumable.
  it('keeps the row when the broadcast result is unknown', async () => {
    const {service, funder, calls} = wire()
    funder.broadcastAssetLock.mockRejectedValue(new Error('no peers'))

    await expect(acquire(service)).rejects.toThrow('no peers')

    expect(calls).toEqual(['build', 'insert'])
    expect(funder.broadcastAssetLock).toHaveBeenCalledTimes(1)
  })

  it('retains the txid so a rejected broadcast can become resumable', async () => {
    const {service, funder} = wire()
    funder.broadcastAssetLock.mockRejectedValue(new Error('no peers'))
    const job = state()

    await expect(service.acquire(job, {
      walletId: WALLET, kind: 'identity', destination: 'dest', amountDuffs: 200_000n, seed: new Uint8Array(64),
    })).rejects.toThrow('no peers')

    expect(job.txid).toBe(TXID)
    service.fail(job, new Error('no peers'))
    expect(job.phase).toBe('resumable')
  })
})
