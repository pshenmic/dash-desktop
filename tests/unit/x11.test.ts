import {describe, it, expect} from 'vitest'
import {x11Wire} from '../../src/main/p2p/x11'
import {hashHeaderRaw} from '../../src/main/p2p/pow'
import {wireToDisplayHex} from '../../src/main/p2p/byteOrder'

const header = (seed: number): Uint8Array =>
  Uint8Array.from({length: 80}, (_, i) => (i * seed) & 0xff)

describe('x11Wire', () => {
  // Pins the backend: this digest was produced by the pure-JS implementation
  // this module replaced, so a regression in the addon shows up here.
  it('produces the known digest for a fixed header', () => {
    expect(Buffer.from(x11Wire(header(7))).toString('hex'))
      .toBe('26f572271b4fdd27c1585be142c3f7f9469b182d34c430f491eee2e1831ead84')
  })

  it('returns 32 bytes in wire order', () => {
    const digest = x11Wire(header(3))

    expect(digest).toHaveLength(32)
    expect(hashHeaderRaw(header(3))).toBe(wireToDisplayHex(digest))
  })

  it('hashes a view into a larger buffer', () => {
    const backing = Uint8Array.from({length: 200}, (_, i) => i & 0xff)

    expect(Buffer.from(x11Wire(backing.subarray(60, 140))).toString('hex'))
      .toBe(Buffer.from(x11Wire(backing.slice(60, 140))).toString('hex'))
  })
})
