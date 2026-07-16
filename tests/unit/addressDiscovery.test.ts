import { describe, it, expect } from 'vitest'
import { HDKey } from '@scure/bip32'
import { mnemonicToSeedSync } from '@scure/bip39'
import { coreAccountPath, deriveCorePublicKey, planGapExtension } from '../../src/main/src/utils/addressDiscovery'

const GAP = 20

function entries(used: number[], count: number) {
  const usedSet = new Set(used)
  return Array.from({ length: count }, (_, index) => ({ index, isUsed: usedSet.has(index) }))
}

describe('planGapExtension', () => {
  it('returns nothing for a fresh chain with a full unused gap', () => {
    expect(planGapExtension(entries([], 20), GAP)).toEqual([])
  })

  it('seeds a full window for an empty chain', () => {
    expect(planGapExtension([], GAP)).toEqual(
      Array.from({ length: 20 }, (_, i) => i),
    )
  })

  it('extends up to lastUsed + gap when a tail address is used', () => {
    expect(planGapExtension(entries([19], 20), GAP)).toEqual(
      Array.from({ length: 20 }, (_, i) => 20 + i),
    )
  })

  it('extends partially when usage sits mid-chain', () => {
    expect(planGapExtension(entries([5], 20), GAP)).toEqual([20, 21, 22, 23, 24, 25])
  })

  it('keeps the gap after repeated extensions', () => {
    const chain = entries([5, 25], 26)
    expect(planGapExtension(chain, GAP)).toEqual(
      Array.from({ length: 20 }, (_, i) => 26 + i),
    )
  })

  it('handles unordered entries', () => {
    const shuffled = [...entries([19], 20)].reverse()
    expect(planGapExtension(shuffled, GAP)).toHaveLength(20)
  })
})

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
