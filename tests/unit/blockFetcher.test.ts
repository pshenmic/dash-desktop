import {describe, it, expect, beforeEach, vi} from 'vitest'
import {BlockFetcher} from '../../src/main/p2p/sync/blockFetcher'
import {PeerRotation} from '../../src/main/p2p/net/peerRotation'
import type {Peer} from 'dash-core-p2p'

const hash = (n: number): Uint8Array => {
  const wire = new Uint8Array(32)
  wire[0] = n & 0xff
  wire[1] = (n >> 8) & 0xff
  return wire
}

const makePeer = (host: string): Peer => ({
  host,
  port: 19999,
  sendMessage: () => undefined,
} as unknown as Peer)

describe('BlockFetcher request memory', () => {
  let fetcher: BlockFetcher
  let peers: Peer[]

  beforeEach(() => {
    vi.useFakeTimers()
    peers = [makePeer('1.1.1.1'), makePeer('2.2.2.2')]
    fetcher = new BlockFetcher({
      rotation: new PeerRotation(() => peers),
      messages: {GetData: () => ({command: 'getdata'})},
    })
  })

  it('knows nothing about a block it never asked for', () => {
    expect(fetcher.wasRequested(hash(1))).toBe(false)
  })

  // Two peers end up holding the same getdata whenever a request is retried, so
  // the second copy arrives with nothing waiting for it.
  it('remembers a block after it was delivered', () => {
    fetcher.request(7, hash(7))
    expect(fetcher.receive(peers[0]!, hash(7))).toBe(7)

    expect(fetcher.receive(peers[1]!, hash(7))).toBeNull()
    expect(fetcher.wasRequested(hash(7))).toBe(true)
  })

  // A rewind abandons every outstanding request, and those blocks still arrive.
  it('remembers a block whose request was abandoned', () => {
    fetcher.request(8, hash(8))
    fetcher.reset()

    expect(fetcher.receive(peers[0]!, hash(8))).toBeNull()
    expect(fetcher.wasRequested(hash(8))).toBe(true)
  })

  it('does not remember one that is still outstanding', () => {
    fetcher.request(9, hash(9))

    expect(fetcher.wasRequested(hash(9))).toBe(false)
    expect(fetcher.size).toBe(1)
  })

  // reject() hands the request to another peer rather than settling it.
  it('keeps a rejected block outstanding', () => {
    fetcher.request(10, hash(10))

    expect(fetcher.reject(hash(10))).toBe(10)
    expect(fetcher.size).toBe(1)
    expect(fetcher.wasRequested(hash(10))).toBe(false)
  })
})
