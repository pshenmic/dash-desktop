import {describe, it, expect, beforeEach, vi} from 'vitest'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {AssetLockService} from '../../src/main/src/services/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/PlatformWorkerService'
import {IdentityRegistrationService} from '../../src/main/src/services/IdentityRegistrationService'
import {AssetLockFundingState} from '../../src/main/src/types/AssetLockFunding'
import {Wallet} from '../../src/main/src/types/Wallet'
import {encryptMnemonic} from '../../src/main/src/utils'
import {AssetLockFundingRow} from '../../src/main/src/types/AssetLock'

const WALLET_ID = 'wallet-1'
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'password123'
const LOCK_AMOUNT = 200_000n
const REGISTRATION_PATH = "m/9'/1'/5'/1'/0"
const TOP_UP_PATH = "m/9'/1'/5'/2'/0"
const TARGET_IDENTITY = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'
const PROOF = {type: 'instantLock', instantLock: 'aa', transaction: 'bb'} as const

const row = (overrides: Partial<AssetLockFundingRow> = {}): AssetLockFundingRow => ({
  id: 1,
  walletId: WALLET_ID,
  txid: 'assetlock-txid',
  outputIndex: 0,
  creditDerivationPath: REGISTRATION_PATH,
  amountDuffs: LOCK_AMOUNT.toString(),
  toPlatformAddress: '',
  kind: 'identity',
  status: 'l1_broadcast',
  stHash: null,
  error: null,
  identityIndex: 0,
  txHex: null,
  assetLockProof: null,
  createdAt: 0,
  ...overrides,
})

describe('identity funding from an asset lock', () => {
  let service: IdentityRegistrationService
  let assetLock: AssetLockService
  let request: ReturnType<typeof vi.fn>
  let insertIdentity: ReturnType<typeof vi.fn>
  let acquire: ReturnType<typeof vi.fn>
  let reacquire: ReturnType<typeof vi.fn>
  let done: ReturnType<typeof vi.fn>
  let fail: ReturnType<typeof vi.fn>
  let state: AssetLockFundingState

  const wallet: Wallet = {
    walletId: WALLET_ID,
    network: 'testnet',
    label: null,
    encryptedMnemonic: encryptMnemonic(MNEMONIC, PASSWORD, 1_000),
    selected: true,
  }

  const settled = (mock: ReturnType<typeof vi.fn>): Promise<void> =>
    vi.waitFor(() => {
      if (mock.mock.calls.length === 0) throw new Error('not settled yet')
    })

  beforeEach(() => {
    state = {
      phase: 'building', kind: 'identity', txid: null, txHeight: null, chainLockedHeight: null,
      lockKind: null, stHash: null, toPlatformAddress: null, identityIdentifier: null,
      amountDuffs: null, error: null,
    }

    acquire = vi.fn().mockResolvedValue({row: row(), proof: PROOF})
    reacquire = vi.fn().mockResolvedValue({row: row(), proof: PROOF})
    done = vi.fn().mockResolvedValue(undefined)
    fail = vi.fn()
    assetLock = {
      begin: vi.fn().mockResolvedValue(state),
      resume: vi.fn().mockReturnValue(state),
      acquire,
      reacquire,
      markBroadcastingSt: vi.fn().mockResolvedValue(undefined),
      done,
      fail,
      countFundings: vi.fn().mockResolvedValue(0),
    } as unknown as AssetLockService

    insertIdentity = vi.fn().mockResolvedValue(undefined)
    const identityDAO = {
      getIdentitiesByWalletId: vi.fn().mockResolvedValue([]),
      getByIdentifier: vi.fn().mockResolvedValue(null),
      insertIdentity,
    } as unknown as IdentityDAO

    request = vi.fn().mockImplementation(async (kind: string) =>
      kind === 'identityScan'
        ? {identities: [], nextFreeIndex: 0}
        : {stHash: 'sthash', identifier: 'identifierABC'})

    service = new IdentityRegistrationService(
      {getWalletById: vi.fn().mockResolvedValue(wallet)} as unknown as WalletDAO,
      identityDAO,
      assetLock,
      {request} as unknown as PlatformWorkerService,
    )
  })

  it('funds the lock with the registration key and settles the identity create', async () => {
    await service.startIdentityCreate(WALLET_ID, LOCK_AMOUNT, PASSWORD)
    await settled(done)

    expect(acquire).toHaveBeenCalledWith(state, expect.objectContaining({
      walletId: WALLET_ID,
      kind: 'identity',
      amountDuffs: LOCK_AMOUNT,
      identityIndex: 0,
      credit: expect.objectContaining({derivationPath: REGISTRATION_PATH}),
    }))
    // The password stopped at startIdentityCreate; the job carries the seed.
    expect(acquire.mock.calls[0][1]).not.toHaveProperty('password')
    expect(request).toHaveBeenCalledWith('identityCreateFromAssetLock', 'testnet', expect.objectContaining({
      txid: 'assetlock-txid',
      assetLockProof: PROOF,
      creditDerivationPath: REGISTRATION_PATH,
      identityIndex: 0,
    }))
    expect(insertIdentity).toHaveBeenCalledWith(
      expect.objectContaining({walletId: WALLET_ID, identityIndex: 0, identifier: 'identifierABC'}),
      'assetlock-txid',
    )
    expect(state.identityIdentifier).toBe('identifierABC')
    expect(done).toHaveBeenCalledWith(state, 'assetlock-txid', 'sthash')
  })

  // The seed is live for as long as the lock takes to confirm, so nothing may
  // still be able to read it once the job is over.
  it('zeroes the seed once the funding settles', async () => {
    await service.startIdentityCreate(WALLET_ID, LOCK_AMOUNT, PASSWORD)
    const {seed} = acquire.mock.calls[0][1] as {seed: Uint8Array}
    expect(seed.some(byte => byte !== 0)).toBe(true)

    await vi.waitFor(() => {
      if (seed.some(byte => byte !== 0)) throw new Error('seed not zeroed yet')
    })
  })

  it('zeroes the seed when the funding fails', async () => {
    request.mockImplementation(async (kind: string) => {
      if (kind === 'identityScan') return {identities: [], nextFreeIndex: 0}
      throw new Error('network down')
    })

    await service.startIdentityCreate(WALLET_ID, LOCK_AMOUNT, PASSWORD)
    const {seed} = acquire.mock.calls[0][1] as {seed: Uint8Array}

    await vi.waitFor(() => {
      if (seed.some(byte => byte !== 0)) throw new Error('seed not zeroed yet')
    })
  })

  it('throws a user-facing error for an invalid password', async () => {
    await expect(
      service.startIdentityCreate(WALLET_ID, LOCK_AMOUNT, 'wrong-password'),
    ).rejects.toThrow('Invalid wallet password')

    expect(acquire).not.toHaveBeenCalled()
  })

  it('hands a failed settlement to the funding state', async () => {
    // The index scan still has to succeed — it runs before the job exists, so
    // its failures throw to the caller rather than landing in the state.
    request.mockImplementation(async (kind: string) => {
      if (kind === 'identityScan') return {identities: [], nextFreeIndex: 0}
      throw new Error('network down')
    })

    await service.startIdentityCreate(WALLET_ID, LOCK_AMOUNT, PASSWORD)
    await settled(fail)

    expect(fail.mock.calls[0][0]).toBe(state)
    expect((fail.mock.calls[0][1] as Error).message).toBe('network down')
    expect(insertIdentity).not.toHaveBeenCalled()
    expect(done).not.toHaveBeenCalled()
  })

  it('tops up an identity with a dedicated top-up funding key', async () => {
    request.mockResolvedValue({stHash: 'topup-sthash'})
    acquire.mockResolvedValue({row: row({kind: 'identityTopUp', toPlatformAddress: TARGET_IDENTITY, creditDerivationPath: TOP_UP_PATH}), proof: PROOF})

    await service.startIdentityTopUp(WALLET_ID, TARGET_IDENTITY, LOCK_AMOUNT, PASSWORD)
    await settled(done)

    expect(acquire).toHaveBeenCalledWith(state, expect.objectContaining({
      kind: 'identityTopUp',
      destination: TARGET_IDENTITY,
      credit: expect.objectContaining({derivationPath: TOP_UP_PATH}),
    }))
    expect(request).toHaveBeenCalledWith('identityTopUpFromAssetLock', 'testnet', expect.objectContaining({
      identifier: TARGET_IDENTITY,
      creditDerivationPath: TOP_UP_PATH,
    }))
    expect(insertIdentity).not.toHaveBeenCalled()
    expect(state.identityIdentifier).toBe(TARGET_IDENTITY)
    expect(done).toHaveBeenCalledWith(state, 'assetlock-txid', 'topup-sthash')
  })

  it('rejects a top-up without an identity identifier', async () => {
    await expect(
      service.startIdentityTopUp(WALLET_ID, '', LOCK_AMOUNT, PASSWORD),
    ).rejects.toThrow('Identity identifier is required')

    expect(acquire).not.toHaveBeenCalled()
  })

  it('resumes a persisted funding by the kind recorded on the row', async () => {
    const stored = row({kind: 'identity', identityIndex: 0})

    await service.resume(WALLET_ID, stored, PASSWORD)
    await settled(done)

    expect(reacquire).toHaveBeenCalledWith(state, stored)
    expect(acquire).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledWith('identityCreateFromAssetLock', 'testnet', expect.objectContaining({identityIndex: 0}))
    expect(insertIdentity).toHaveBeenCalledOnce()
  })
})