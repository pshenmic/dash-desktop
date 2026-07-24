import {beforeEach, describe, expect, it, vi} from 'vitest'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformAddressService} from '../../src/main/src/services/PlatformAddressService'
import type {WalletDAO} from '../../src/main/src/database/WalletDAO'
import type {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import type {IdentityKeyDAO} from '../../src/main/src/database/IdentityKeyDAO'
import type {SdkProvider} from '../../src/main/src/providers/SdkProvider'
import type {ShieldedService} from '../../src/main/src/services/ShieldedService'
import {decryptSecret, encryptMnemonic, encryptSecret} from '../../src/main/src/utils'
import type {Wallet} from '../../src/main/src/types/Wallet'

const WALLET_ID = 'wallet-1'
const IDENTITY_ID = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'
const PASSWORD = 'password123'
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const TRANSFER_KEY_HEX = 'a1286dd195e2b8e1f6bdc946c56a53e0c544750d6452ddc0f4c593ef311f21af'

describe('PlatformAddressService.importIdentity', () => {
  let service: PlatformAddressService
  let identityDAO: IdentityDAO
  let identityKeyDAO: IdentityKeyDAO
  let insertImportedIdentity: ReturnType<typeof vi.fn>
  let publicKeyHash: string

  const wallet: Wallet = {
    walletId: WALLET_ID,
    network: 'testnet',
    label: null,
    encryptedMnemonic: encryptMnemonic(MNEMONIC, PASSWORD, 1_000),
    selected: true,
    platformXpub: 'platform-xpub',
  }

  beforeEach(() => {
    publicKeyHash = PrivateKeyWASM.fromHex(TRANSFER_KEY_HEX, 'testnet').getPublicKeyHash()

    const walletDAO = {
      getWalletById: vi.fn().mockResolvedValue(wallet),
    } as unknown as WalletDAO

    identityDAO = {
      getByIdentifier: vi.fn().mockResolvedValue(null),
      getIdentitiesByWalletId: vi.fn().mockResolvedValue([]),
    } as unknown as IdentityDAO

    insertImportedIdentity = vi.fn().mockResolvedValue(undefined)
    identityKeyDAO = {
      insertImportedIdentity,
    } as unknown as IdentityKeyDAO

    const sdkProvider = {
      getPlatformSDK: vi.fn().mockReturnValue({
        identities: {
          getIdentityByIdentifier: vi.fn().mockResolvedValue({id: {base58: () => IDENTITY_ID}}),
          getIdentityPublicKeys: vi.fn().mockResolvedValue([{
            keyId: 3,
            purpose: 'TRANSFER',
            getPublicKeyHash: () => publicKeyHash,
          }]),
        },
      }),
    } as unknown as SdkProvider

    service = new PlatformAddressService(
      walletDAO,
      identityDAO,
      identityKeyDAO,
      sdkProvider,
      {} as ShieldedService,
      1_000,
    )
  })

  it('verifies, encrypts and stores a matching transfer key', async () => {
    const result = await service.importIdentity(WALLET_ID, IDENTITY_ID, [TRANSFER_KEY_HEX], PASSWORD)

    expect(result).toEqual({
      identifier: IDENTITY_ID,
      importedKeyIds: [3],
      hasTransferKey: true,
    })
    expect(insertImportedIdentity).toHaveBeenCalledOnce()

    const [identity, keys] = insertImportedIdentity.mock.calls[0]
    expect(identity).toMatchObject({
      walletId: WALLET_ID,
      identifier: IDENTITY_ID,
      identityIndex: -1,
      isImported: true,
    })
    expect(keys).toHaveLength(1)
    expect(keys[0].encryptedPrivateKey).not.toContain(TRANSFER_KEY_HEX)
    expect(decryptSecret(keys[0].encryptedPrivateKey, MNEMONIC)).toBe(TRANSFER_KEY_HEX)
  })

  it('rejects a key that is not registered on the identity', async () => {
    const otherKey = '44a8195e242364b935e9d7ff2106ed109e9baf3800907f5e58a259fdfd1ca5e5'

    await expect(service.importIdentity(WALLET_ID, IDENTITY_ID, [otherKey], PASSWORD))
      .rejects.toThrow('do not belong to this identity')
    expect(insertImportedIdentity).not.toHaveBeenCalled()
  })

  it('rejects an incorrect wallet password before storing keys', async () => {
    await expect(service.importIdentity(WALLET_ID, IDENTITY_ID, [TRANSFER_KEY_HEX], 'wrong-password'))
      .rejects.toThrow('Invalid wallet password')
    expect(insertImportedIdentity).not.toHaveBeenCalled()
  })

  it('rejects importing an identity already attached to the wallet', async () => {
    vi.mocked(identityDAO.getByIdentifier).mockResolvedValue({
      walletId: WALLET_ID,
      identityIndex: 0,
      derivationPath: '',
      identifier: IDENTITY_ID,
    })

    await expect(service.importIdentity(WALLET_ID, IDENTITY_ID, [TRANSFER_KEY_HEX], PASSWORD))
      .rejects.toThrow('already in this wallet')
    expect(insertImportedIdentity).not.toHaveBeenCalled()
  })

  it('uses an imported transfer key to sign identity credit transfers', async () => {
    const privateKey = PrivateKeyWASM.fromHex(TRANSFER_KEY_HEX, 'testnet')
    const identityPublicKey = {
      keyId: 3,
      purpose: 'TRANSFER',
      getPublicKeyHash: () => privateKey.getPublicKeyHash(),
    }
    const sign = vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]))
    const stateTransition = {
      signature: null,
      signaturePublicKeyId: null,
      sign,
      hash: vi.fn().mockReturnValue('state-transition-hash'),
    }
    const broadcast = vi.fn().mockResolvedValue(undefined)
    const waitForStateTransitionResult = vi.fn().mockResolvedValue(undefined)

    const signingService = new PlatformAddressService(
      {getWalletById: vi.fn().mockResolvedValue(wallet)} as unknown as WalletDAO,
      {getIdentitiesByWalletId: vi.fn().mockResolvedValue([{
        walletId: WALLET_ID,
        identityIndex: -1,
        derivationPath: '',
        identifier: IDENTITY_ID,
        isImported: true,
      }])} as unknown as IdentityDAO,
      {getByIdentity: vi.fn().mockResolvedValue([{
        walletId: WALLET_ID,
        identityIdentifier: IDENTITY_ID,
        keyId: 3,
        publicKeyHash: privateKey.getPublicKeyHash(),
        encryptedPrivateKey: encryptSecret(TRANSFER_KEY_HEX, MNEMONIC, 1_000),
      }])} as unknown as IdentityKeyDAO,
      {
        getPlatformSDK: vi.fn().mockReturnValue({
          keyPair: {
            mnemonicToSeed: vi.fn().mockReturnValue(new Uint8Array([1])),
            seedToHdKey: vi.fn().mockReturnValue({}),
          },
          identities: {
            getIdentityPublicKeys: vi.fn().mockResolvedValue([identityPublicKey]),
            getIdentityBalance: vi.fn().mockResolvedValue(20_000_000n),
            getIdentityNonce: vi.fn().mockResolvedValue(1n),
            createStateTransition: vi.fn().mockReturnValue(stateTransition),
          },
          stateTransitions: {broadcast, waitForStateTransitionResult},
        }),
      } as unknown as SdkProvider,
      {} as ShieldedService,
      1_000,
    )

    await signingService.transferIdentityCredits(
      WALLET_ID,
      IDENTITY_ID,
      '7XvBHxC16cvcLwCf8M2oeG8rKpHMbCqgRrS2mKsGJjVG',
      1_000_000n,
      PASSWORD,
    )

    expect(sign).toHaveBeenCalledOnce()
    expect(sign.mock.calls[0][0].hex().toLowerCase()).toBe(TRANSFER_KEY_HEX)
    expect(sign.mock.calls[0][1]).toBe(identityPublicKey)
    expect(stateTransition.signaturePublicKeyId).toBe(3)
    expect(broadcast).toHaveBeenCalledWith(stateTransition)
  })
})
