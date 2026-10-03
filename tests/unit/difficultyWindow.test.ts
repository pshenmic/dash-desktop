import {describe, it, expect} from 'vitest'
import {DifficultyWindow} from '../../src/main/p2p/store/difficultyWindow'
import {DIFFICULTY_SEED, DIFFICULTY_WINDOW_DEPTH} from '../../src/main/p2p/constants'
import type {ChainStore} from '../../src/main/p2p/store/ChainStore'

function rawHeader(time: number, nBits: number): Uint8Array {
  const raw = new Uint8Array(80)
  const view = new DataView(raw.buffer)
  view.setUint32(68, time, true)
  view.setUint32(72, nBits, true)
  return raw
}

function storeWith(from: number, to: number): ChainStore {
  return {
    network: 'mainnet',
    iterateHeadersInRange: async (lo: number, hi: number) => {
      const out: Array<{height: number; raw: Uint8Array}> = []
      for (let h = Math.max(lo, from); h <= Math.min(hi, to); h++) {
        out.push({height: h, raw: rawHeader(1_400_000_000 + h, 0x1b000000 + h)})
      }
      return out
    },
  } as unknown as ChainStore
}

describe('DifficultyWindow', () => {
  it('holds the seed below every floor', async () => {
    const window = new DifficultyWindow()
    await window.load(storeWith(2, 200_000), 200_000, DIFFICULTY_SEED.mainnet)

    expect(window.at(0)).toEqual(DIFFICULTY_SEED.mainnet[0])
    expect(window.at(1)).toEqual(DIFFICULTY_SEED.mainnet[1])
    // Far below the floor, so it is not simply still in range.
    expect(window.at(100_000)).toBeUndefined()
  })

  it('loads exactly DIFFICULTY_WINDOW_DEPTH below the tip', async () => {
    const tip = 200_000
    const window = new DifficultyWindow()
    await window.load(storeWith(2, tip), tip, DIFFICULTY_SEED.mainnet)

    expect(window.at(tip)).toBeDefined()
    expect(window.at(tip - DIFFICULTY_WINDOW_DEPTH)).toBeDefined()
    expect(window.at(tip - DIFFICULTY_WINDOW_DEPTH - 1)).toBeUndefined()
  })

  it('reads time and nBits off the stored header', async () => {
    const window = new DifficultyWindow()
    await window.load(storeWith(2, 100), 100, DIFFICULTY_SEED.mainnet)
    expect(window.at(50)).toEqual({height: 50, time: 1_400_000_050, nBits: 0x1b000032})
  })

  it('drops everything above a fork so the losing branch cannot answer', async () => {
    const window = new DifficultyWindow()
    await window.load(storeWith(2, 100), 100, DIFFICULTY_SEED.mainnet)
    for (let h = 101; h <= 110; h++) window.record({height: h, time: 1_500_000_000 + h, nBits: 0x1c000000})

    window.rewindTo(104)

    expect(window.at(104)).toBeDefined()
    expect(window.at(105)).toBeUndefined()
    expect(window.at(110)).toBeUndefined()

    // The replacement branch writes over the same heights.
    window.record({height: 105, time: 1_600_000_105, nBits: 0x1d000000})
    expect(window.at(105)).toEqual({height: 105, time: 1_600_000_105, nBits: 0x1d000000})
  })

  it('prunes as the tip advances but keeps the depth intact', async () => {
    const window = new DifficultyWindow()
    await window.load(storeWith(2, 100), 100, DIFFICULTY_SEED.mainnet)

    const tip = 100 + DIFFICULTY_WINDOW_DEPTH + 500
    for (let h = 101; h <= tip; h++) window.record({height: h, time: 1_500_000_000 + h, nBits: 0x1c000000})

    expect(window.at(tip)).toBeDefined()
    expect(window.at(tip - DIFFICULTY_WINDOW_DEPTH)).toBeDefined()
    expect(window.at(tip - DIFFICULTY_WINDOW_DEPTH - 1)).toBeUndefined()
    expect(window.at(0)).toBeDefined()
    expect(window.at(1)).toBeDefined()
  })

  it('starts from the seed alone on a fresh chain.db', async () => {
    const window = new DifficultyWindow()
    await window.load(storeWith(2, 0), 1, DIFFICULTY_SEED.testnet)
    expect(window.at(1)).toEqual(DIFFICULTY_SEED.testnet[1])
    expect(window.at(2)).toBeUndefined()
  })
})
