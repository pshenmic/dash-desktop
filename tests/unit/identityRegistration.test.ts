import {describe, it, expect, vi} from 'vitest'
import {SdkProvider} from '../../src/main/src/providers/SdkProvider'
import {IdentityRegistrationService, IDENTITY_KEY_DEFINITIONS} from '../../src/main/src/services/IdentityRegistrationService'

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('IdentityRegistrationService', () => {
  const service = new IdentityRegistrationService(new SdkProvider())

  describe('key derivation', () => {
    it('derives distinct registration keys per identity index', async () => {
      const key0 = await service.deriveRegistrationKey(MNEMONIC, 0, 'testnet')
      const key1 = await service.deriveRegistrationKey(MNEMONIC, 1, 'testnet')

      expect(key0.hex()).not.toBe(key1.hex())
      // Deterministic: same index → same key.
      const key0Again = await service.deriveRegistrationKey(MNEMONIC, 0, 'testnet')
      expect(key0Again.hex()).toBe(key0.hex())
    })

    it('derives all 6 identity keys, each distinct', async () => {
      const keys = await service.deriveIdentityKeys(MNEMONIC, 0, 'testnet')

      expect(keys).toHaveLength(IDENTITY_KEY_DEFINITIONS.length)
      const hexes = new Set(keys.map(k => k.hex()))
      expect(hexes.size).toBe(IDENTITY_KEY_DEFINITIONS.length)
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

  describe('buildIdentityTopUpTransition', () => {
    it('creates a topUp transition and signs it with the funding key only', () => {
      const stateTransition = {signByPrivateKey: vi.fn()}
      const createStateTransition = vi.fn().mockReturnValue(stateTransition)
      const localService = new IdentityRegistrationService({
        getPlatformSDK: () => ({identities: {createStateTransition}}),
      } as unknown as SdkProvider)

      const fundingKey = {} as never
      const assetLockProof = {type: 'instantLock'} as never
      const result = localService.buildIdentityTopUpTransition('identifierABC', fundingKey, assetLockProof, 'testnet')

      expect(result).toBe(stateTransition)
      expect(createStateTransition).toHaveBeenCalledWith('topUp', {identityId: 'identifierABC', assetLockProof})
      expect(stateTransition.signByPrivateKey).toHaveBeenCalledOnce()
      expect(stateTransition.signByPrivateKey.mock.calls[0][0]).toBe(fundingKey)
    })
  })

  describe('findNextIdentityIndex', () => {
    it('returns the start index when no identity is registered', async () => {
      const sdkProvider = new SdkProvider()
      const sdk = sdkProvider.getPlatformSDK('testnet')
      vi.spyOn(sdk.identities, 'getIdentityByPublicKeyHash').mockRejectedValue(new Error('offline'))
      vi.spyOn(sdk.identities, 'getIdentityByNonUniquePublicKeyHash').mockRejectedValue(new Error('offline'))

      const localService = new IdentityRegistrationService(sdkProvider)
      const index = await localService.findNextIdentityIndex(MNEMONIC, 0, 'testnet')

      expect(index).toBe(0)
    })

    it('skips an index whose auth key is already registered', async () => {
      const sdkProvider = new SdkProvider()
      const sdk = sdkProvider.getPlatformSDK('testnet')
      vi.spyOn(sdk.identities, 'getIdentityByPublicKeyHash')
        .mockResolvedValueOnce({} as never)
        .mockResolvedValue(null as never)
      vi.spyOn(sdk.identities, 'getIdentityByNonUniquePublicKeyHash').mockResolvedValue(null as never)

      const localService = new IdentityRegistrationService(sdkProvider)
      const index = await localService.findNextIdentityIndex(MNEMONIC, 0, 'testnet')

      expect(index).toBe(1)
    })
  })
})
