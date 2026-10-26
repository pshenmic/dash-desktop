import { describe, it, expect } from 'vitest'
import { KeyPairController } from 'dash-platform-sdk/src/keyPair/index.js'
import {
  deriveFundingXpubs,
  findDerivedAddress,
  fundingAddressDeriver,
  fundingKeyPath,
} from '../../src/main/src/utils/fundingKeys'
import { FundingKeyUsage } from '../../src/main/src/types/AssetLockRecovery'

const keyPair = new KeyPairController()
const SEED = keyPair.mnemonicToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')

describe('fundingKeyPath', () => {
  it('follows the DIP-13 funding branches', () => {
    expect(fundingKeyPath('testnet', 'registration', 0)).toBe("m/9'/1'/5'/1'/0")
    expect(fundingKeyPath('mainnet', 'registration', 3)).toBe("m/9'/5'/5'/1'/3")
    expect(fundingKeyPath('testnet', 'topUp', 0)).toBe("m/9'/1'/5'/2'/0")
    expect(fundingKeyPath('mainnet', 'topUp', 3)).toBe("m/9'/5'/5'/2'/3")
  })
})

describe('fundingAddressDeriver', () => {
  it.each([
    ['mainnet', 'registration'],
    ['mainnet', 'topUp'],
    ['testnet', 'registration'],
    ['testnet', 'topUp'],
  ] as const)('reproduces the seed-derived credit address on %s %s', async (network, usage: FundingKeyUsage) => {
    const xpubs = await deriveFundingXpubs(SEED, network)
    const xpub = usage === 'registration' ? xpubs.registrationFundingXpub : xpubs.topUpFundingXpub
    const deriver = fundingAddressDeriver(xpub, network, usage)
    const hdKey = keyPair.seedToHdKey(SEED, network)

    for (const index of [0, 1, 7]) {
      const fromSeed = await keyPair.derivePath(hdKey, fundingKeyPath(network, usage, index))
      expect(deriver.derive(index)).toEqual({
        index,
        address: keyPair.p2pkhAddress(fromSeed.publicKey!, network),
        derivationPath: fundingKeyPath(network, usage, index),
      })
    }
  })
})

describe('findDerivedAddress', () => {
  it('finds an address within the limit and gives up past it', async () => {
    const {topUpFundingXpub} = await deriveFundingXpubs(SEED, 'testnet')
    const deriver = fundingAddressDeriver(topUpFundingXpub, 'testnet', 'topUp')
    const target = deriver.derive(4).address

    expect(findDerivedAddress(deriver, target, 5)?.index).toBe(4)
    expect(findDerivedAddress(deriver, target, 4)).toBeNull()
  })
})
