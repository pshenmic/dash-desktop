import {describe, it, expect, vi} from 'vitest'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {AssetLockService} from '../../src/main/src/services/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/PlatformWorkerService'
import {AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {IdentityRegistrationService} from '../../src/main/src/services/IdentityRegistrationService'
import {IDENTITY_KEY_DEFINITIONS} from '../../src/main/src/constants'
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const SEED = new KeyPairController().mnemonicToSeed(MNEMONIC)

function serviceWith(request = vi.fn()): IdentityRegistrationService {
  return new IdentityRegistrationService(
    {} as WalletDAO,
    {} as IdentityDAO,
    {} as AssetLockService,
    {request} as unknown as PlatformWorkerService,
    {} as unknown as AssetLockFunder,
  )
}

describe('IdentityRegistrationService', () => {
  const service = serviceWith()

  describe('key derivation', () => {
    it('derives distinct registration keys per identity index', async () => {
      const key0 = await service.deriveRegistrationKey(SEED, 0, 'testnet')
      const key1 = await service.deriveRegistrationKey(SEED, 1, 'testnet')

      expect(key0.hex()).not.toBe(key1.hex())
      // Deterministic: same index → same key.
      const key0Again = await service.deriveRegistrationKey(SEED, 0, 'testnet')
      expect(key0Again.hex()).toBe(key0.hex())
    })

    it('derives top-up keys distinct from registration keys at the same index', async () => {
      const topUpKey0 = await service.deriveTopUpKey(SEED, 0, 'testnet')
      const topUpKey1 = await service.deriveTopUpKey(SEED, 1, 'testnet')
      const registrationKey0 = await service.deriveRegistrationKey(SEED, 0, 'testnet')

      expect(topUpKey0.hex()).not.toBe(topUpKey1.hex())
      expect(topUpKey0.hex()).not.toBe(registrationKey0.hex())
      const topUpKey0Again = await service.deriveTopUpKey(SEED, 0, 'testnet')
      expect(topUpKey0Again.hex()).toBe(topUpKey0.hex())
    })
  })

  // The identityCreateFromAssetLock worker operation derives one key per
  // definition off the same hd key; a collision would sign two identity keys
  // with the same secret.
  describe('identity key definitions', () => {
    it('derive to six distinct keys at one identity index', () => {
      const keyPair = new KeyPairController()
      const hdKey = keyPair.seedToHdKey(keyPair.mnemonicToSeed(MNEMONIC), 'testnet')

      const hexes = IDENTITY_KEY_DEFINITIONS.map(({id}) => {
        const derived = keyPair.deriveIdentityPrivateKey(hdKey, 0, id, 'testnet')
        return PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, 'testnet').hex()
      })

      expect(new Set(hexes).size).toBe(IDENTITY_KEY_DEFINITIONS.length)
    })
  })

  describe('registrationKeyPath', () => {
    it('follows DIP-13 m/9\'/coin\'/5\'/1\'/index per network', () => {
      expect(service.registrationKeyPath(0, 'testnet')).toBe("m/9'/1'/5'/1'/0")
      expect(service.registrationKeyPath(3, 'mainnet')).toBe("m/9'/5'/5'/1'/3")
    })
  })

  describe('topUpKeyPath', () => {
    it('follows DIP-13 m/9\'/coin\'/5\'/2\'/index per network', () => {
      expect(service.topUpKeyPath(0, 'testnet')).toBe("m/9'/1'/5'/2'/0")
      expect(service.topUpKeyPath(3, 'mainnet')).toBe("m/9'/5'/5'/2'/3")
    })
  })

  // The walk itself is the identityScan operation's, and is tested there.
  describe('findNextIdentityIndex', () => {
    it('asks the worker to stop at the first free index', async () => {
      const request = vi.fn().mockResolvedValue({identities: [], nextFreeIndex: 4})

      const index = await serviceWith(request).findNextIdentityIndex(SEED, 2, 'testnet')

      expect(index).toBe(4)
      expect(request).toHaveBeenCalledWith('identityScan', 'testnet', expect.objectContaining({
        seed: SEED,
        startIndex: 2,
        gapLimit: 1,
      }))
    })
  })
})