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

  // The cfilter scan rewinds its whole in-flight window every time the gap runs
  // short, so an extension that lands exactly on the limit makes the next used
  // address pay for another one.
  describe('minBatch', () => {
    it('derives a full batch when only one index is short', () => {
      // lastUsed 2, maxIndex 21: the limit alone asks for index 22 and nothing more.
      const chain = entries([2], 22)

      expect(planGapExtension(chain, GAP)).toEqual([22])
      expect(planGapExtension(chain, GAP, 10)).toEqual(
        Array.from({length: 10}, (_, i) => 22 + i),
      )
    })

    it('still reaches the gap limit when that is further than the batch', () => {
      const chain = entries([19], 20)

      expect(planGapExtension(chain, GAP, 5)).toEqual(
        Array.from({length: 20}, (_, i) => 20 + i),
      )
    })

    it('derives nothing while the gap is already satisfied', () => {
      expect(planGapExtension(entries([], 20), GAP, 10)).toEqual([])
      expect(planGapExtension(entries([5], 26), GAP, 10)).toEqual([])
    })

    // A run of used addresses is what the batch exists to absorb: extending by
    // the minimum each time is one rewind per address.
    it('absorbs a run of newly used addresses in fewer extensions', () => {
      const count = (batch: number): number => {
        const used = new Set([0])
        let known = GAP
        let rounds = 0
        for (let nextUsed = 1; nextUsed <= 10; nextUsed++) {
          used.add(nextUsed)
          const chain = Array.from({length: known}, (_, i) => ({index: i, isUsed: used.has(i)}))
          const added = planGapExtension(chain, GAP, batch)
          if (added.length > 0) {
            rounds++
            known += added.length
          }
        }
        return rounds
      }

      expect(count(1)).toBe(10)
      expect(count(10)).toBe(2)
    })
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
