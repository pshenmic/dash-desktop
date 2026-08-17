import {describe, it, expect} from 'vitest'
import {gcsMatchAny} from 'crypto-toothpick'
import {CompactFilter, GCS_M, GCS_P, deriveFilterKey, siphash24} from 'dash-core-p2p'

// The cfilter scan matches through crypto-toothpick rather than dash-core-p2p's
// CompactFilter. A wrong answer here does not throw — it silently stops seeing
// blocks that pay us — so the two are checked against each other, and both
// against filters built here from the BIP-158 rules.

const blockHash = (seed: number): Uint8Array =>
  Uint8Array.from({length: 32}, (_, i) => (seed * 31 + i * 7) & 0xff)

const item = (seed: number): Uint8Array =>
  Uint8Array.from({length: 25}, (_, i) => (seed * 131 + i * 17) & 0xff)

// Where an item lands in a filter of `n` elements, per BIP 158.
const scaled = (value: Uint8Array, k0: bigint, k1: bigint, n: number): bigint =>
  (siphash24(k0, k1, value) * (BigInt(n) * GCS_M)) >> 64n

class BitWriter {
  private bytes: number[] = []
  private current = 0
  private used = 0

  push(bit: number): void {
    this.current = (this.current << 1) | bit
    if (++this.used === 8) {
      this.bytes.push(this.current)
      this.current = 0
      this.used = 0
    }
  }

  pushBits(value: bigint, width: number): void {
    for (let i = width - 1; i >= 0; i--) this.push(Number((value >> BigInt(i)) & 1n))
  }

  finish(): Uint8Array {
    while (this.used !== 0) this.push(0)
    return Uint8Array.from(this.bytes)
  }
}

// Golomb-Rice coded set over the given members: unary quotient, then P-bit
// remainder, over the ascending differences.
function encodeFilter(members: bigint[]): Uint8Array {
  const sorted = [...new Set(members)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const bits = new BitWriter()
  let last = 0n
  for (const value of sorted) {
    const delta = value - last
    last = value
    const quotient = delta >> BigInt(GCS_P)
    for (let q = 0n; q < quotient; q++) bits.push(1)
    bits.push(0)
    bits.pushBits(delta & ((1n << BigInt(GCS_P)) - 1n), GCS_P)
  }
  const body = bits.finish()

  if (sorted.length >= 0xfd) throw new Error('test filters stay under a one-byte varint')
  const out = new Uint8Array(1 + body.length)
  out[0] = sorted.length
  out.set(body, 1)
  return out
}

// A filter whose members are exactly the scaled hashes of `contents`.
function filterOf(contents: Uint8Array[], hash: Uint8Array): Uint8Array {
  const {k0, k1} = deriveFilterKey(hash)
  return encodeFilter(contents.map(value => scaled(value, k0, k1, contents.length)))
}

const reference = (filter: Uint8Array, hash: Uint8Array, items: Uint8Array[]): boolean =>
  new CompactFilter(filter, hash).matchAny(items)

const subject = (filter: Uint8Array, hash: Uint8Array, items: Uint8Array[]): boolean =>
  gcsMatchAny(filter, hash, items, {p: GCS_P, m: GCS_M})

describe('gcsMatchAny', () => {
  it('finds an item the filter contains', () => {
    const hash = blockHash(1)
    const contents = [item(1), item(2), item(3)]
    const filter = filterOf(contents, hash)

    expect(subject(filter, hash, [item(2)])).toBe(true)
    expect(reference(filter, hash, [item(2)])).toBe(true)
  })

  it('rejects an item the filter does not contain', () => {
    const hash = blockHash(2)
    const filter = filterOf([item(1), item(2), item(3)], hash)

    expect(subject(filter, hash, [item(99)])).toBe(false)
    expect(reference(filter, hash, [item(99)])).toBe(false)
  })

  it('finds one member among many watched items', () => {
    const hash = blockHash(3)
    const filter = filterOf([item(1), item(2), item(3)], hash)
    const watched = [...Array.from({length: 200}, (_, i) => item(500 + i)), item(3)]

    expect(subject(filter, hash, watched)).toBe(true)
    expect(reference(filter, hash, watched)).toBe(true)
  })

  it('returns false for an empty filter or an empty watch set', () => {
    const hash = blockHash(4)

    expect(subject(encodeFilter([]), hash, [item(1)])).toBe(false)
    expect(subject(filterOf([item(1)], hash), hash, [])).toBe(false)
  })

  // WatchSet.items holds subarray views, whose byteOffset is not zero.
  it('handles items that are views into a larger buffer', () => {
    const hash = blockHash(5)
    const backing = Uint8Array.from({length: 200}, (_, i) => i & 0xff)
    const view = backing.subarray(40, 65)
    const filter = filterOf([view], hash)

    expect(subject(filter, hash, [view])).toBe(true)
    expect(reference(filter, hash, [view])).toBe(true)
  })

  it('agrees with dash-core-p2p across varied filters and watch sets', () => {
    for (let round = 0; round < 40; round++) {
      const hash = blockHash(round)
      const contents = Array.from({length: 1 + (round % 30)}, (_, i) => item(round * 50 + i))
      const filter = filterOf(contents, hash)

      // A watch set that sometimes overlaps the filter and sometimes does not.
      const watched = [
        ...Array.from({length: round % 10}, (_, i) => item(9000 + i)),
        ...(round % 3 === 0 ? [contents[round % contents.length]!] : []),
      ]

      expect(subject(filter, hash, watched)).toBe(reference(filter, hash, watched))
    }
  })
})
