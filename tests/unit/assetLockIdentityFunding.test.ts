import {describe, it, expect, beforeEach, vi} from 'vitest'
import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {AssetLockService, AssetLockFundingState} from '../../src/main/src/services/AssetLockService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {AssetLockDAO, AssetLockFundingRow} from '../../src/main/src/database/AssetLockDAO'
import {WalletService} from '../../src/main/src/services/WalletService'
import {ShieldedService} from '../../src/main/src/services/ShieldedService'
import {SdkProvider} from '../../src/main/src/services/SdkProvider'
import {IdentityRegistrationService} from '../../src/main/src/services/IdentityRegistrationService'
import {Wallet} from '../../src/main/src/types/Wallet'
import {encryptMnemonic} from '../../src/main/src/utils'

const WALLET_ID = 'wallet-1'
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'password123'
const LOCK_AMOUNT = 200_000n
const REGISTRATION_PATH = "m/9'/1'/5'/1'/0"
const TOP_UP_PATH = "m/9'/1'/5'/2'/0"
const TARGET_IDENTITY = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'

async function waitForSettled(state: AssetLockFundingState): Promise<void> {
  await vi.waitFor(() => {
    if (state.phase !== 'done' && state.phase !== 'error' && state.phase !== 'resumable') {
      throw new Error(`still ${state.phase}`)
    }
  })
}

describe('AssetLockService identity funding', () => {
  let service: AssetLockService
  let walletDAO: WalletDAO
  let identityDAO: IdentityDAO
  let assetLockDAO: AssetLockDAO
  let walletService: WalletService
  let sdkProvider: SdkProvider
  let identityRegistrationService: IdentityRegistrationService

  let buildAndBroadcastAssetLock: ReturnType<typeof vi.fn>
  let insertFunding: ReturnType<typeof vi.fn>
  let updateStatus: ReturnType<typeof vi.fn>
  let getActiveFunding: ReturnType<typeof vi.fn>
  let stBroadcast: ReturnType<typeof vi.fn>
  let waitForStResult: ReturnType<typeof vi.fn>
  let insertIdentity: ReturnType<typeof vi.fn>
  let removeIdentity: ReturnType<typeof vi.fn>
  let waitForAssetLockProof: ReturnType<typeof vi.fn>

  const assetLockTx = {hex: () => 'aabbcc'}
  const stateTransition = {
    getOwnerId: () => ({base58: () => 'identifierABC'}),
    hash: () => 'sthash',
  }
  const topUpTransition = {hash: () => 'topup-sthash'}

  const wallet: Wallet = {
    walletId: WALLET_ID,
    network: 'testnet',
    label: null,
    encryptedMnemonic: encryptMnemonic(MNEMONIC, PASSWORD, 1_000),
    selected: true,
  }

  beforeEach(() => {
    walletDAO = {getWalletById: vi.fn().mockResolvedValue(wallet)} as unknown as WalletDAO

    insertIdentity = vi.fn().mockResolvedValue(undefined)
    removeIdentity = vi.fn().mockResolvedValue(undefined)
    identityDAO = {
      getIdentitiesByWalletId: vi.fn().mockResolvedValue([]),
      getByIdentifier: vi.fn().mockResolvedValue(null),
      insertIdentity,
      removeIdentity,
    } as unknown as IdentityDAO

    let insertedRow: AssetLockFundingRow | null = null
    insertFunding = vi.fn().mockImplementation(async funding => {
      insertedRow = {...funding, id: 1, stHash: null, error: null}
    })
    updateStatus = vi.fn().mockResolvedValue(undefined)
    getActiveFunding = vi.fn().mockImplementation(async () => insertedRow)
    assetLockDAO = {insertFunding, updateStatus, getActiveFunding, countFundingsByKind: vi.fn().mockResolvedValue(0)} as unknown as AssetLockDAO

    buildAndBroadcastAssetLock = vi.fn().mockResolvedValue({
      tx: assetLockTx,
      txid: 'assetlock-txid',
      creditAddress: 'credit-addr',
      creditDerivationPath: REGISTRATION_PATH,
      inputAddresses: ['recv-addr'],
    })
    walletService = {buildAndBroadcastAssetLock} as unknown as WalletService

    stBroadcast = vi.fn().mockResolvedValue(undefined)
    waitForStResult = vi.fn().mockResolvedValue(undefined)
    sdkProvider = {
      getPlatformSDK: vi.fn().mockReturnValue({
        keyPair: {p2pkhAddress: vi.fn().mockReturnValue('credit-addr')},
        stateTransitions: {broadcast: stBroadcast, waitForStateTransitionResult: waitForStResult},
      }),
    } as unknown as SdkProvider

    waitForAssetLockProof = vi.fn().mockResolvedValue({type: 'instantLock'})
    identityRegistrationService = {
      findNextIdentityIndex: vi.fn().mockResolvedValue(0),
      deriveRegistrationKey: vi.fn().mockResolvedValue({getPublicKey: () => ({bytes: () => new Uint8Array([1, 2, 3])})}),
      registrationKeyPath: vi.fn().mockReturnValue(REGISTRATION_PATH),
      deriveTopUpKey: vi.fn().mockResolvedValue({getPublicKey: () => ({bytes: () => new Uint8Array([4, 5, 6])})}),
      topUpKeyPath: vi.fn().mockReturnValue(TOP_UP_PATH),
      waitForAssetLockProof,
      deriveIdentityKeys: vi.fn().mockResolvedValue([]),
      buildIdentityCreateTransition: vi.fn().mockReturnValue(stateTransition),
      buildIdentityTopUpTransition: vi.fn().mockReturnValue(topUpTransition),
    } as unknown as IdentityRegistrationService

    service = new AssetLockService(walletDAO, identityDAO, assetLockDAO, walletService, {} as ShieldedService, sdkProvider, identityRegistrationService)
  })

  it('funds the asset lock, waits for proof, broadcasts the ST and persists the identity', async () => {
    const state = await service.startFunding(WALLET_ID, '', LOCK_AMOUNT, PASSWORD, 'identity')
    await waitForSettled(state)

    expect(state.phase).toBe('done')
    expect(state.identityIdentifier).toBe('identifierABC')
    expect(state.stHash).toBe('sthash')
    expect(buildAndBroadcastAssetLock).toHaveBeenCalledWith(
      WALLET_ID,
      LOCK_AMOUNT,
      PASSWORD,
      {address: 'credit-addr', derivationPath: REGISTRATION_PATH},
    )
    expect(insertFunding).toHaveBeenCalledWith(expect.objectContaining({kind: 'identity', identityIndex: 0, txHex: 'aabbcc'}))
    expect(waitForAssetLockProof).toHaveBeenCalledWith(assetLockTx, 'assetlock-txid', ['recv-addr'], 'testnet')
    expect(insertIdentity).toHaveBeenCalledWith(
      expect.objectContaining({walletId: WALLET_ID, identityIndex: 0, identifier: 'identifierABC'}),
      'assetlock-txid',
    )
    expect(stBroadcast).toHaveBeenCalledWith(stateTransition)
    expect(waitForStResult).toHaveBeenCalledOnce()
    expect(updateStatus).toHaveBeenCalledWith('assetlock-txid', 'done', {stHash: 'sthash'})
  })

  it('throws a user-facing error for an invalid password', async () => {
    await expect(
      service.startFunding(WALLET_ID, '', LOCK_AMOUNT, 'wrong-password', 'identity'),
    ).rejects.toThrow('Invalid wallet password')

    expect(buildAndBroadcastAssetLock).not.toHaveBeenCalled()
  })

  it('rolls back the persisted identity and stays resumable when the ST broadcast fails', async () => {
    stBroadcast.mockRejectedValue(new Error('network down'))

    const state = await service.startFunding(WALLET_ID, '', LOCK_AMOUNT, PASSWORD, 'identity')
    await waitForSettled(state)

    expect(state.phase).toBe('resumable')
    expect(state.error).toBe('network down')
    expect(removeIdentity).toHaveBeenCalledWith(WALLET_ID, 'identifierABC')
  })

  it('treats an already-in-chain ST as success and skips waiting', async () => {
    stBroadcast.mockRejectedValue(new Error('state transition already in chain'))

    const state = await service.startFunding(WALLET_ID, '', LOCK_AMOUNT, PASSWORD, 'identity')
    await waitForSettled(state)

    expect(state.phase).toBe('done')
    expect(state.identityIdentifier).toBe('identifierABC')
    expect(removeIdentity).not.toHaveBeenCalled()
    expect(waitForStResult).not.toHaveBeenCalled()
  })

  it('resumes a persisted identity funding from the stored tx hex', async () => {
    const txHex = new SDKTransaction().hex()
    const row: AssetLockFundingRow = {
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
      txHex,
      createdAt: 0,
    }
    getActiveFunding.mockResolvedValue(row)

    const state = await service.resumeFunding(WALLET_ID, PASSWORD)
    await waitForSettled(state)

    expect(state.phase).toBe('done')
    expect(state.identityIdentifier).toBe('identifierABC')
    const [tx, txid, watchAddresses, network] = waitForAssetLockProof.mock.calls[0]
    expect(tx).toBeInstanceOf(SDKTransaction)
    expect(tx.hex()).toBe(txHex)
    expect(txid).toBe('assetlock-txid')
    expect(watchAddresses).toEqual(['credit-addr'])
    expect(network).toBe('testnet')
    expect(insertIdentity).toHaveBeenCalledOnce()
  })

  it('tops up an identity from L1 with a dedicated top-up funding key', async () => {
    const state = await service.startFunding(WALLET_ID, TARGET_IDENTITY, LOCK_AMOUNT, PASSWORD, 'identityTopUp')
    await waitForSettled(state)

    expect(state.phase).toBe('done')
    expect(state.stHash).toBe('topup-sthash')
    expect(state.identityIdentifier).toBe(TARGET_IDENTITY)
    expect(buildAndBroadcastAssetLock).toHaveBeenCalledWith(
      WALLET_ID,
      LOCK_AMOUNT,
      PASSWORD,
      {address: 'credit-addr', derivationPath: TOP_UP_PATH},
    )
    expect(insertFunding).toHaveBeenCalledWith(expect.objectContaining({kind: 'identityTopUp', identityIndex: 0, toPlatformAddress: TARGET_IDENTITY}))
    const buildTopUp = vi.mocked(identityRegistrationService.buildIdentityTopUpTransition)
    expect(buildTopUp.mock.calls[0][0]).toBe(TARGET_IDENTITY)
    expect(buildTopUp.mock.calls[0][2]).toEqual({type: 'instantLock'})
    expect(stBroadcast).toHaveBeenCalledWith(topUpTransition)
    expect(insertIdentity).not.toHaveBeenCalled()
    expect(updateStatus).toHaveBeenCalledWith('assetlock-txid', 'done', {stHash: 'topup-sthash'})
  })

  it('rejects a top-up without an identity identifier', async () => {
    await expect(
      service.startFunding(WALLET_ID, '', LOCK_AMOUNT, PASSWORD, 'identityTopUp'),
    ).rejects.toThrow('Identity identifier is required')

    expect(buildAndBroadcastAssetLock).not.toHaveBeenCalled()
  })
})
