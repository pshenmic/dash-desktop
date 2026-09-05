import {describe, it, expect} from 'vitest'
import {PeerRegistry} from '../../src/main/p2p/net/peerRegistry'
import {dialTarget, parsePeerAddress, peerTarget} from '../../src/main/p2p/net/peerAddress'

const lock = {}
const bulk = {}
const socket = (): object => ({})

describe('the dial target an address resolves to', () => {
  // What dash-core-p2p's own key misses: it hashes both ip halves, and every
  // gossiped entry carries both, so one node arrives under many keys.
  it('is the same for two gossip entries that dial one host', () => {
    const a = {ip: {v6: '0000:0000:0000:0000:0000:ffff:4443:7a26', v4: '68.67.122.38'}, port: 19999}
    const b = {ip: {v6: '2a01:4f8:1c17:6e4b:0000:0000:0000:0001', v4: '68.67.122.38'}, port: 19999}

    expect(dialTarget(a, 19999)).toBe(dialTarget(b, 19999))
  })

  it('falls back to the network port when the entry carries none', () => {
    expect(dialTarget({ip: {v4: '68.67.122.38'}} as never, 19999)).toBe('68.67.122.38:19999')
  })

  it('is the v6 literal when that is what would be dialled', () => {
    expect(dialTarget(parsePeerAddress('[2a01:4f8::1]:19999', 19999)!, 19999)).toBe('2a01:4f8::1:19999')
  })

  // The claim is taken from the socket and looked up from the address book, so
  // the two have to spell one node the same way.
  it('is what the socket that address opens reports', () => {
    const addr = {ip: {v6: '0000:0000:0000:0000:0000:ffff:4443:7a26', v4: '68.67.122.38'}, port: 19999}

    expect(peerTarget({host: '68.67.122.38', port: 19999} as never)).toBe(dialTarget(addr, 19999))
  })
})

describe('one socket per node across pools', () => {
  it('gives the target to whoever claims it first', () => {
    const registry = new PeerRegistry()

    expect(registry.claim('68.67.122.38:19999', lock, socket())).toBe(true)
    expect(registry.claim('68.67.122.38:19999', bulk, socket())).toBe(false)
    expect(registry.heldByOther('68.67.122.38:19999', bulk)).toBe(true)
    expect(registry.heldByOther('68.67.122.38:19999', lock)).toBe(false)
  })

  it('lets the socket holding it keep claiming it', () => {
    const registry = new PeerRegistry()
    const held = socket()
    registry.claim('68.67.122.38:19999', lock, held)

    expect(registry.claim('68.67.122.38:19999', lock, held)).toBe(true)
  })

  // A pool asking twice for one node is the same duplicate as two pools asking
  // once — it is the second socket that makes Core hang up on both.
  it('refuses a second socket of the pool that already holds it', () => {
    const registry = new PeerRegistry()
    registry.claim('68.67.122.38:19999', lock, socket())

    expect(registry.claim('68.67.122.38:19999', lock, socket())).toBe(false)
  })

  it('frees a target when the socket holding it goes, and not before', () => {
    const registry = new PeerRegistry()
    const held = socket()
    registry.claim('68.67.122.38:19999', lock, held)

    registry.release('68.67.122.38:19999', socket())
    expect(registry.heldByOther('68.67.122.38:19999', bulk)).toBe(true)

    registry.release('68.67.122.38:19999', held)
    expect(registry.claim('68.67.122.38:19999', bulk, socket())).toBe(true)
  })

  // Nothing signals a dropped peer here; each pool reports what it still holds.
  it('frees a target the holder no longer has a socket for', () => {
    const registry = new PeerRegistry()
    registry.claim('68.67.122.38:19999', lock, socket())
    registry.claim('89.169.164.19:19999', lock, socket())

    registry.keepOnly(lock, new Set(['89.169.164.19:19999']))

    expect(registry.claim('68.67.122.38:19999', bulk, socket())).toBe(true)
    expect(registry.heldByOther('89.169.164.19:19999', bulk)).toBe(true)
  })

  it('leaves the other pool holdings alone when one reports in', () => {
    const registry = new PeerRegistry()
    registry.claim('68.67.122.38:19999', bulk, socket())

    registry.keepOnly(lock, new Set())

    expect(registry.heldByOther('68.67.122.38:19999', lock)).toBe(true)
  })
})
