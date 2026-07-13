import {describe, it, expect, beforeEach, vi} from 'vitest'
import {RegisterIdentityHandler} from '../../src/main/src/api/wallet/registerIdentity'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {WalletService} from '../../src/main/src/services/WalletService'
import {SdkProvider} from '../../src/main/src/services/SdkProvider'
import {IdentityRegistrationService} from '../../src/main/src/services/IdentityRegistrationService'
import {Wallet} from '../../src/main/src/types/Wallet'
import {encryptMnemonic} from '../../src/main/src/utils'

const WALLET_ID = 'wallet-1'
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'password123'
const LOCK_AMOUNT = '200000'
const REGISTRATION_PATH = "m/9'/1'/5'/1'/0"

describe('RegisterIdentityHandler', () => {
  let handler: RegisterIdentityHandler
  let walletDAO: WalletDAO
  let identityDAO: IdentityDAO
  let walletService: WalletService
  let sdkProvider: SdkProvider
  let identityRegistrationService: IdentityRegistrationService

  let buildAndBroadcastAssetLock: ReturnType<typeof vi.fn>
  let stBroadcast: ReturnType<typeof vi.fn>
  let waitForStResult: ReturnType<typeof vi.fn>
  let insertIdentity: ReturnType<typeof vi.fn>
  let removeIdentity: ReturnType<typeof vi.fn>
  let waitForAssetLockProof: ReturnType<typeof vi.fn>

  const assetLockTx = {hash: () => 'assetlock-txid'}
  const stateTransition = {
    getOwnerId: () => ({base58: () => 'identifierABC'}),
    hash: () => 'sthash',
  }

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
      waitForAssetLockProof,
      deriveIdentityKeys: vi.fn().mockResolvedValue([]),
      buildIdentityCreateTransition: vi.fn().mockReturnValue(stateTransition),
    } as unknown as IdentityRegistrationService

    handler = new RegisterIdentityHandler(walletDAO, identityDAO, walletService, sdkProvider, identityRegistrationService)
  })

  it('funds the asset lock, waits for proof, broadcasts the ST and persists the identity', async () => {
    const result = await handler.handle(null as never, WALLET_ID, LOCK_AMOUNT, PASSWORD)

    expect(result).toEqual({identifier: 'identifierABC', stateTransitionHash: 'sthash'})
    expect(buildAndBroadcastAssetLock).toHaveBeenCalledWith(
      WALLET_ID,
      200_000n,
      PASSWORD,
      {address: 'credit-addr', derivationPath: REGISTRATION_PATH},
    )
    expect(waitForAssetLockProof).toHaveBeenCalledWith(assetLockTx, 'assetlock-txid', ['recv-addr'], 'testnet')
    expect(insertIdentity).toHaveBeenCalledOnce()
    expect(stBroadcast).toHaveBeenCalledWith(stateTransition)
    expect(waitForStResult).toHaveBeenCalledOnce()
  })

  it('rejects a non-positive lock amount before loading the wallet', async () => {
    await expect(
      handler.handle(null as never, WALLET_ID, '0', PASSWORD),
    ).rejects.toThrow('Lock amount must be greater than zero')

    expect(walletDAO.getWalletById).not.toHaveBeenCalled()
  })

  it('throws when the wallet does not exist', async () => {
    vi.mocked(walletDAO.getWalletById).mockResolvedValue(null)

    await expect(
      handler.handle(null as never, WALLET_ID, LOCK_AMOUNT, PASSWORD),
    ).rejects.toThrow('Wallet not found')
  })

  it('throws a user-facing error for an invalid password', async () => {
    await expect(
      handler.handle(null as never, WALLET_ID, LOCK_AMOUNT, 'wrong-password'),
    ).rejects.toThrow('Invalid wallet password')

    expect(buildAndBroadcastAssetLock).not.toHaveBeenCalled()
  })

  it('rolls back the persisted identity when the ST broadcast fails', async () => {
    stBroadcast.mockRejectedValue(new Error('network down'))

    await expect(
      handler.handle(null as never, WALLET_ID, LOCK_AMOUNT, PASSWORD),
    ).rejects.toThrow('network down')

    expect(removeIdentity).toHaveBeenCalledWith(WALLET_ID, 'identifierABC')
  })

  it('treats an already-in-chain ST as success and skips waiting', async () => {
    stBroadcast.mockRejectedValue(new Error('state transition already in chain'))

    const result = await handler.handle(null as never, WALLET_ID, LOCK_AMOUNT, PASSWORD)

    expect(result.identifier).toBe('identifierABC')
    expect(removeIdentity).not.toHaveBeenCalled()
    expect(waitForStResult).not.toHaveBeenCalled()
  })
})
