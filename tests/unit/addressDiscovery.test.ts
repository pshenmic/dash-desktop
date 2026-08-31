import { describe, it, expect } from 'vitest'
import { HDKey } from '@scure/bip32'
import { mnemonicToSeedSync } from '@scure/bip39'
import { coreAccountPath, coreAddressDeriver, deriveCorePublicKey } from '../../src/main/src/utils/addressDiscovery'

describe('deriveCorePublicKey', () => {
  const versions = {
    mainnet: { private: 0x0488ade4, public: 0x0488b21e },
    testnet: { private: 0x04358394, public: 0x043587cf },
  } as const

  const seed = mnemonicToSeedSync('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')

  it.each(['mainnet', 'testnet'] as const)('reproduces seed-path public keys on %s', (network) => {
    const coinType = network === 'mainnet' ? 5 : 1
    const master = HDKey.fromMasterSeed(seed, versions[network])
    const accountNode = master.derive(coreAccountPath(coinType, 0))
    const xpub = accountNode.publicExtendedKey

    for (const isChange of [false, true]) {
      for (const index of [0, 1, 19, 45]) {
        const fromSeed = master.derive(`${coreAccountPath(coinType, 0)}/${isChange ? 1 : 0}/${index}`).publicKey
        const fromXpub = deriveCorePublicKey(xpub, network, isChange, index)
        expect(Buffer.from(fromXpub).toString('hex')).toBe(Buffer.from(fromSeed!).toString('hex'))
      }
    }
  })

  it('derives distinct keys per chain and index', () => {
    const master = HDKey.fromMasterSeed(seed, versions.testnet)
    const xpub = master.derive(coreAccountPath(1, 0)).publicExtendedKey
    const keys = [
      deriveCorePublicKey(xpub, 'testnet', false, 0),
      deriveCorePublicKey(xpub, 'testnet', false, 1),
      deriveCorePublicKey(xpub, 'testnet', true, 0),
    ].map(k => Buffer.from(k).toString('hex'))
    expect(new Set(keys).size).toBe(3)
  })
})

describe('coreAddressDeriver', () => {
  const seed = mnemonicToSeedSync('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
  const xpub = HDKey.fromMasterSeed(seed, { private: 0x04358394, public: 0x043587cf })
    .derive(coreAccountPath(1, 0)).publicExtendedKey

  it('pairs each address with the path it was derived from', () => {
    expect(coreAddressDeriver(xpub, 'testnet', false).derive(75)).toMatchObject({
      index: 75,
      derivationPath: "m/44'/1'/0'/0/75",
    })
    expect(coreAddressDeriver(xpub, 'testnet', true).derive(3).derivationPath).toBe("m/44'/1'/0'/1/3")
  })

  it('derives distinct addresses per chain and index', () => {
    const addresses = [
      coreAddressDeriver(xpub, 'testnet', false).derive(0).address,
      coreAddressDeriver(xpub, 'testnet', false).derive(1).address,
      coreAddressDeriver(xpub, 'testnet', true).derive(0).address,
    ]

    expect(new Set(addresses).size).toBe(3)
  })
})
