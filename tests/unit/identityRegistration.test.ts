import {describe, it, expect, vi} from 'vitest'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {SdkProvider} from '../../src/main/src/providers/SdkProvider'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {AssetLockService} from '../../src/main/src/services/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/PlatformWorkerService'
import {IdentityRegistrationService, IDENTITY_KEY_DEFINITIONS} from '../../src/main/src/services/IdentityRegistrationService'

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

function serviceWith(sdkProvider: SdkProvider): IdentityRegistrationService {
  return new IdentityRegistrationService(
    sdkProvider,
    {} as WalletDAO,
    {} as IdentityDAO,
    {} as AssetLockService,
    {} as PlatformWorkerService,
  )
}

describe('IdentityRegistrationService', () => {
  const service = serviceWith(new SdkProvider())

  describe('key derivation', () => {
    it('derives distinct registration keys per identity index', async () => {
      const key0 = await service.deriveRegistrationKey(MNEMONIC, 0, 'testnet')
      const key1 = await service.deriveRegistrationKey(MNEMONIC, 1, 'testnet')

      expect(key0.hex()).not.toBe(key1.hex())
      // Deterministic: same index → same key.
      const key0Again = await service.deriveRegistrationKey(MNEMONIC, 0, 'testnet')
      expect(key0Again.hex()).toBe(key0.hex())
    })

    it('derives top-up keys distinct from registration keys at the same index', async () => {
      const topUpKey0 = await service.deriveTopUpKey(MNEMONIC, 0, 'testnet')
      const topUpKey1 = await service.deriveTopUpKey(MNEMONIC, 1, 'testnet')
      const registrationKey0 = await service.deriveRegistrationKey(MNEMONIC, 0, 'testnet')

      expect(topUpKey0.hex()).not.toBe(topUpKey1.hex())
      expect(topUpKey0.hex()).not.toBe(registrationKey0.hex())
      const topUpKey0Again = await service.deriveTopUpKey(MNEMONIC, 0, 'testnet')
      expect(topUpKey0Again.hex()).toBe(topUpKey0.hex())
    })
  })

  // The identityCreateFromAssetLock worker operation derives one key per
  // definition off the same hd key; a collision would sign two identity keys
  // with the same secret.
  describe('identity key definitions', () => {
    it('derive to six distinct keys at one identity index', () => {
      const {keyPair} = new SdkProvider().getPlatformSDK('testnet')
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

  describe('findNextIdentityIndex', () => {
    it('returns the start index when no identity is registered', async () => {
      const sdkProvider = new SdkProvider()
      const sdk = sdkProvider.getPlatformSDK('testnet')
      vi.spyOn(sdk.identities, 'getIdentityByPublicKeyHash').mockRejectedValue(new Error('offline'))
      vi.spyOn(sdk.identities, 'getIdentityByNonUniquePublicKeyHash').mockRejectedValue(new Error('offline'))

      const index = await serviceWith(sdkProvider).findNextIdentityIndex(MNEMONIC, 0, 'testnet')

      expect(index).toBe(0)
    })

    it('skips an index whose auth key is already registered', async () => {
      const sdkProvider = new SdkProvider()
      const sdk = sdkProvider.getPlatformSDK('testnet')
      vi.spyOn(sdk.identities, 'getIdentityByPublicKeyHash')
        .mockResolvedValueOnce({} as never)
        .mockResolvedValue(null as never)
      vi.spyOn(sdk.identities, 'getIdentityByNonUniquePublicKeyHash').mockResolvedValue(null as never)

      const index = await serviceWith(sdkProvider).findNextIdentityIndex(MNEMONIC, 0, 'testnet')

      expect(index).toBe(1)
    })
  })
})