import {describe, it, expect} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {bitsAccepted, expectedBits, expectedBitsForRange} from '../../src/main/p2p/utils/difficulty'
import {bitsToTarget, targetToCompact} from '../../src/main/p2p/utils/pow'
import {
  DGW_ACTIVATION_HEIGHT,
  DGW_PAST_BLOCKS,
  DGW_TOLERANCE_HEIGHT,
  DIFFICULTY_ADJUSTMENT_INTERVAL,
  KGW_ACTIVATION_HEIGHT,
  POW_LIMIT_BITS,
  POW_LIMIT_TARGET,
} from '../../src/main/p2p/constants'
import type {Network} from '../../src/main/src/types/Network'
import type {DifficultyBlock, DifficultyLookup} from '../../src/main/p2p/types/difficulty'

// Real headers off the p2p network, as runs of contiguous history around each
// era and its boundaries: repeated [u32 startHeight][u32 count][count x (u32
// time, u32 nBits)]. Each run carries enough blocks below its first answerable
// height to seed that era's walk; heights in the gaps have no context, so
// expectedBits declines them and they are skipped. This is frozen chain
// history, so a mismatch is a rule we got wrong, never a chain that moved.
function loadChain(name: string): Map<number, DifficultyBlock> {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'difficulty', `${name}.bin`))
  const blocks = new Map<number, DifficultyBlock>()
  let offset = 0
  while (offset < buf.length) {
    const start = buf.readUInt32LE(offset)
    const count = buf.readUInt32LE(offset + 4)
    offset += 8
    for (let i = 0; i < count; i++) {
      blocks.set(start + i, {
        height: start + i,
        time: buf.readUInt32LE(offset + i * 8),
        nBits: buf.readUInt32LE(offset + 4 + i * 8),
      })
    }
    offset += count * 8
  }
  return blocks
}

const chains: Record<Network, Map<number, DifficultyBlock>> = {
  mainnet: loadChain('mainnet'),
  testnet: loadChain('testnet'),
}

function lookup(network: Network): DifficultyLookup {
  return height => chains[network].get(height)
}

// Only the blocks DGW v1/v2 produced are allowed to merely land inside the
// tolerance band; every other height has to reproduce nBits exactly, or a bug in
// the interval retarget or KGW would hide behind mainnet's wide early window.
function producedByRetiredDGW(network: Network, height: number): boolean {
  return height >= DGW_ACTIVATION_HEIGHT[network] && height <= DGW_TOLERANCE_HEIGHT[network]
}

function walk(network: Network): {checked: Set<number>; tolerated: number; failures: string[]; eras: Set<string>} {
  const blocks = chains[network]
  const at = lookup(network)
  const heights = [...blocks.keys()].sort((a, b) => a - b)
  const failures: string[] = []
  const eras = new Set<string>()
  const checked = new Set<number>()
  let tolerated = 0

  for (const height of heights) {
    if (height === heights[0]) continue
    const block = blocks.get(height)!
    const required = expectedBits(network, height - 1, block.time, at)
    if (required == null) continue
    checked.add(height)
    eras.add(height < KGW_ACTIVATION_HEIGHT[network]
      ? 'interval'
      : height < DGW_ACTIVATION_HEIGHT[network] ? 'kgw' : 'dgw')

    const ok = producedByRetiredDGW(network, height)
      ? bitsAccepted(network, height, block.nBits, required)
      : required === block.nBits
    if (producedByRetiredDGW(network, height) && required !== block.nBits) tolerated++
    if (!ok && failures.length < 5) {
      failures.push(`h=${height} got=0x${required.toString(16)} want=0x${block.nBits.toString(16)}`)
    }
  }
  return {checked, tolerated, failures, eras}
}

describe('targetToCompact', () => {
  it('round-trips every nBits the real chain carries', () => {
    const seen = new Set<number>()
    for (const blocks of Object.values(chains)) {
      for (const block of blocks.values()) seen.add(block.nBits)
    }
    expect(seen.size).toBeGreaterThan(100)
    for (const nBits of seen) expect(targetToCompact(bitsToTarget(nBits))).toBe(nBits)
  })

  it('encodes powLimit as POW_LIMIT_BITS', () => {
    expect(targetToCompact(POW_LIMIT_TARGET)).toBe(POW_LIMIT_BITS)
  })

  it('shifts the mantissa down when it would set the sign bit', () => {
    // 0x00800000 is the sign flag, so a target whose top byte reaches it has to
    // come back a byte wider rather than negative.
    expect(targetToCompact(0x00800000n)).toBe(0x04008000)
    expect(targetToCompact(0n)).toBe(0)
  })
})

describe('expectedBits against the real chain', () => {
  it('reproduces mainnet across all three eras and both boundaries', () => {
    const {checked, tolerated, failures, eras} = walk('mainnet')
    expect(failures).toEqual([])
    expect(eras).toEqual(new Set(['interval', 'kgw', 'dgw']))
    // Named rather than counted, so the fixture can be resized without quietly
    // dropping the heights that decide a rule.
    for (const height of [
      DIFFICULTY_ADJUSTMENT_INTERVAL,      // the one retarget spanning interval-1
      DIFFICULTY_ADJUSTMENT_INTERVAL * 2,  // and the first that spans the full interval
      KGW_ACTIVATION_HEIGHT.mainnet,
      25_767,                              // the deepest KGW walk in the era
      DGW_ACTIVATION_HEIGHT.mainnet,
      DGW_TOLERANCE_HEIGHT.mainnet,        // last height the band covers
      DGW_TOLERANCE_HEIGHT.mainnet + 1,    // first that must match exactly
      2_538_742,                           // present-day difficulty
    ]) expect(checked).toContain(height)
    // The band is only ever reached inside the DGW v1/v2 window.
    expect(tolerated).toBeGreaterThan(0)
  })

  it('reproduces testnet, both min-difficulty rules included', () => {
    const {checked, tolerated, failures, eras} = walk('testnet')
    expect(failures).toEqual([])
    expect(eras).toEqual(new Set(['interval', 'dgw']))
    expect(tolerated).toBe(0)
    for (const height of [
      DIFFICULTY_ADJUSTMENT_INTERVAL,
      KGW_ACTIVATION_HEIGHT.testnet,       // DGW v3 starts here too on testnet
      DGW_ACTIVATION_HEIGHT.testnet + 400,
    ]) expect(checked).toContain(height)
  })

  it('never falls back to the tolerance band on testnet', () => {
    expect(DGW_TOLERANCE_HEIGHT.testnet).toBe(0)
    const at = lookup('testnet')
    const block = chains.testnet.get(4_400)!
    const required = expectedBits('testnet', 4_399, block.time, at)!
    expect(bitsAccepted('testnet', 4_400, required + 1, required)).toBe(false)
  })
})

describe('rejection', () => {
  it('rejects a tampered nBits above the tolerance height', () => {
    const at = lookup('mainnet')
    const height = 68_650
    const block = chains.mainnet.get(height)!
    const required = expectedBits('mainnet', height - 1, block.time, at)!
    expect(bitsAccepted('mainnet', height, block.nBits, required)).toBe(true)
    expect(bitsAccepted('mainnet', height, POW_LIMIT_BITS, required)).toBe(false)
  })

  it('still rejects a min-difficulty forgery inside the tolerance window', () => {
    // The band is +/-50% of the difficulty, not a licence to mine at powLimit.
    const at = lookup('mainnet')
    const height = 34_300
    const block = chains.mainnet.get(height)!
    const required = expectedBits('mainnet', height - 1, block.time, at)!
    expect(bitsAccepted('mainnet', height, block.nBits, required)).toBe(true)
    expect(bitsAccepted('mainnet', height, POW_LIMIT_BITS, required)).toBe(false)
  })
})

describe('an incomplete window', () => {
  const at = lookup('mainnet')

  it('answers null rather than guessing when a KGW walk runs off the end', () => {
    // Under KGW_PAST_BLOCKS_MIN the event horizon can never end the walk, so it
    // reaches the edge of the window instead.
    const truncated: DifficultyLookup = height => (height < 33_990 ? undefined : at(height))
    expect(expectedBits('mainnet', 34_000, chains.mainnet.get(34_001)!.time, truncated)).toBeNull()
  })

  it('answers a KGW height whose walk ends before the edge of the window', () => {
    const truncated: DifficultyLookup = height => (height < 33_100 ? undefined : at(height))
    const block = chains.mainnet.get(34_001)!
    expect(expectedBits('mainnet', 34_000, block.time, truncated)).not.toBeNull()
  })

  it('answers null when the parent itself is missing', () => {
    expect(expectedBits('mainnet', 90_000, 1_500_000_000, at)).toBeNull()
  })

  it('still answers DGW from its exact past-block count', () => {
    // Above DGW_TOLERANCE_HEIGHT, so the answer has to be the real nBits.
    const height = DGW_TOLERANCE_HEIGHT.mainnet + 61
    const narrow: DifficultyLookup = h => (h < height - DGW_PAST_BLOCKS ? undefined : at(h))
    const block = chains.mainnet.get(height)!
    expect(expectedBits('mainnet', height - 1, block.time, narrow)).toBe(block.nBits)
  })
})

// The batched native path has to answer exactly what the per-header path does,
// or a batch straddling a min-difficulty block would validate differently from
// the same headers arriving one at a time.
describe('expectedBitsForRange', () => {
  // Contiguous stretches of one fixture run, since a range is indexed by position.
  const runs: Array<[string, Network, number, number]> = [
    ['mainnet at v3 activation', 'mainnet', DGW_ACTIVATION_HEIGHT.mainnet, 34_400],
    ['mainnet at present-day difficulty', 'mainnet', 2_538_567, 2_538_742],
    ['testnet with min-difficulty', 'testnet', DGW_ACTIVATION_HEIGHT.testnet, 4_500],
  ]

  for (const [name, network, firstHeight, lastHeight] of runs) {
    it(`agrees with the per-header path — ${name}`, () => {
      const chain = chains[network]
      const at: DifficultyLookup = height => chain.get(height)
      const range: number[] = []
      for (let h = firstHeight; h <= lastHeight; h++) range.push(h)
      expect(range.length).toBeGreaterThan(100)

      const startHeight = range[0]! - 1
      const got = expectedBitsForRange(network, startHeight, range.map(h => chain.get(h)!), at)

      expect(got).not.toBeNull()
      expect(got!.length).toBe(range.length)
      for (let i = 0; i < range.length; i++) {
        const height = range[i]!
        expect(got![i]).toBe(expectedBits(network, height - 1, chain.get(height)!.time, at))
      }
    })
  }

  it('carries the min-difficulty override the averaged range cannot see', () => {
    const at: DifficultyLookup = height => chains.testnet.get(height)
    const heights = [...chains.testnet.keys()].sort((a, b) => a - b)
      .filter(h => h >= DGW_ACTIVATION_HEIGHT.testnet)
    const startHeight = heights[0]! - 1
    const got = expectedBitsForRange('testnet', startHeight, heights.map(h => chains.testnet.get(h)!), at)!

    // Testnet reaches the eased branch often; without it the batch would differ
    // from what the chain really carries.
    const eased = heights.filter((h, i) => got[i] !== undefined
      && chains.testnet.get(h)!.time - chains.testnet.get(h - 1)!.time > 600)
    expect(eased.length).toBeGreaterThan(0)
    for (let i = 0; i < heights.length; i++) {
      expect(got[i]).toBe(chains.testnet.get(heights[i]!)!.nBits)
    }
  })

  it('declines a range below v3 and one the window cannot seed', () => {
    const at: DifficultyLookup = height => chains.mainnet.get(height)
    const below = [{height: 20_001, time: 1_400_000_000, nBits: 0x1d00ffff}]
    expect(expectedBitsForRange('mainnet', 20_000, below, at)).toBeNull()

    const narrow: DifficultyLookup = height => (height < 68_650 ? undefined : chains.mainnet.get(height))
    const batch = [chains.mainnet.get(68_651)!]
    expect(expectedBitsForRange('mainnet', 68_650, batch, narrow)).toBeNull()
    expect(expectedBitsForRange('mainnet', 68_650, [], at)).toBeNull()
  })

  // A peer picks the nBits and the times, so neither may reach the binding in a
  // shape that throws out of header validation.
  it('never throws on a header a hostile peer could send', () => {
    const at: DifficultyLookup = height => chains.mainnet.get(height)
    const time = chains.mainnet.get(68_651)!.time
    for (const nBits of [0, 1, 0xffffffff, 0x00800000, 0x207fffff, 0xff7fffff, 0x03000000]) {
      for (const t of [0, time, 0xffffffff]) {
        const batch = [{height: 68_651, time: t, nBits}]
        expect(() => expectedBitsForRange('mainnet', 68_650, batch, at)).not.toThrow()
      }
    }
    // And a garbage nBits is still refused, by the target check that runs first.
    expect(bitsToTarget(0) <= 0n).toBe(true)
    expect(bitsToTarget(0xff7fffff) > POW_LIMIT_TARGET).toBe(true)
  })
})
