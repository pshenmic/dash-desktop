import {describe, it, expect} from 'vitest'
import {siphash24WithKeys} from 'crypto-toothpick'
import {siphash24 as reference} from 'dash-core-p2p'

// The filter matching in CFilterSyncWorker runs on crypto-toothpick rather than
// dash-core-p2p's own bigint SipHash. A wrong digest there does not throw — it
// silently stops matching blocks that pay us — so the two are pinned against
// each other and against the published vectors.

// The key the SipHash-2-4 reference vectors are published under.
const K0 = 0x0706050403020100n
const K1 = 0x0f0e0d0c0b0a0908n

const bytes = (n: number): Uint8Array => Uint8Array.from({length: n}, (_, i) => i)

describe('siphash24 reference vectors', () => {
  // Published in the SipHash paper (Aumasson & Bernstein) for this key.
  it('matches the published digest for the empty message', () => {
    expect(siphash24WithKeys(K0, K1, new Uint8Array(0)).toString(16)).toBe('726fdb47dd0e0e31')
  })

  it('matches the published digest for a 15-byte message', () => {
    expect(siphash24WithKeys(K0, K1, bytes(15)).toString(16)).toBe('a129ca6149be45e5')
  })
})

describe('siphash24 against the dash-core-p2p implementation', () => {
  // Lengths either side of the 8-byte block boundary, where the tail packing
  // and the length byte are easiest to get wrong.
  it.each([0, 1, 7, 8, 9, 15, 16, 17, 23, 24, 25, 31, 32, 64, 100])(
    'agrees on a %i-byte message',
    (len) => {
      expect(siphash24WithKeys(K0, K1, bytes(len))).toBe(reference(K0, K1, bytes(len)))
    },
  )

  it('agrees across varied keys and payloads', () => {
    for (let n = 0; n < 200; n++) {
      const data = Uint8Array.from({length: n % 40}, (_, i) => (n * 7 + i * 13) & 0xff)
      const k0 = (BigInt(n) * 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn
      const k1 = (BigInt(n) * 0xc2b2ae3d27d4eb4fn) & 0xffffffffffffffffn
      expect(siphash24WithKeys(k0, k1, data)).toBe(reference(k0, k1, data))
    }
  })

  // Keys cross the binding as decimal strings, so the unsigned top half is
  // where a signedness slip would show up.
  it('handles keys with the top bits set', () => {
    const k0 = 0xffffffffffffffffn
    const k1 = 0x8000000000000001n
    expect(siphash24WithKeys(k0, k1, bytes(25))).toBe(reference(k0, k1, bytes(25)))
  })

  // matchAny hashes p2pkh scripts and outpoints, which are subarray views whose
  // byteOffset is not zero.
  it('hashes a view into a larger buffer', () => {
    const backing = bytes(100)
    const view = backing.subarray(33, 58)
    expect(siphash24WithKeys(K0, K1, view)).toBe(reference(K0, K1, view))
  })
})
