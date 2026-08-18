import {describe, it, expect} from 'vitest'
import {PeerRotation} from '../../src/main/p2p/peerRotation'
import type {Peer} from 'dash-core-p2p'

const peer = (host: string): Peer => ({host} as unknown as Peer)

describe('PeerRotation', () => {
  const a = peer('a'), b = peer('b'), c = peer('c')
  const over = (...peers: Peer[]): PeerRotation => new PeerRotation(() => peers)

  it('prefers peers that have neither been tried nor gone silent', () => {
    const r = over(a, b, c)
    r.markSilent([a])
    const tried = new Set([b])

    expect(r.candidates(tried)).toEqual([c])
  })

  it('falls back to untried peers when every fresh one is silent', () => {
    const r = over(a, b)
    r.markSilent([a, b])

    expect(r.candidates(new Set([b]))).toEqual([a])
  })

  // Otherwise a request whose peers have all been tried has nobody left to ask
  // and stalls until its timeout, forever.
  it('resets and returns everyone once tried and silent are exhausted', () => {
    const r = over(a, b)
    const tried = new Set([a, b])
    r.markSilent([a, b])

    expect(r.candidates(tried)).toEqual([a, b])
    expect(tried.size).toBe(0)
    expect(r.silentCount).toBe(0)
  })

  it('caps a pick at the race width', () => {
    expect(over(a, b, c).pick(2)).toEqual([a, b])
  })

  it('clears the silent mark when a peer answers', () => {
    const r = over(a, b)
    r.markSilent([a])
    expect(r.isSilent(a)).toBe(true)

    r.markResponsive(a)

    expect(r.isSilent(a)).toBe(false)
  })

  it('reads the source per call, so peers connecting later are seen', () => {
    const peers: Peer[] = [a]
    const r = new PeerRotation(() => peers)
    expect(r.candidates()).toEqual([a])

    peers.push(b)

    expect(r.candidates()).toEqual([a, b])
  })

  describe('first()', () => {
    it('skips silent peers', () => {
      const r = over(a, b)
      r.markSilent([a])

      expect(r.first(new Set())).toBe(b)
    })

    it('returns a silent peer rather than nobody', () => {
      const r = over(a)
      r.markSilent([a])

      expect(r.first(new Set())).toBe(a)
    })

    it('honours the exclude set', () => {
      expect(over(a, b).first(new Set([a]))).toBe(b)
    })

    it('is undefined when there are no peers at all', () => {
      expect(over().first(new Set())).toBeUndefined()
    })
  })

  // The cf* paths and the block path draw on different pools but the same
  // sockets, so silence observed on one has to count on the other.
  describe('over()', () => {
    it('shares silence with its parent in both directions', () => {
      const cf = over(a, b)
      const blocks = cf.over(() => [a, b, c])

      cf.markSilent([a])
      expect(blocks.isSilent(a)).toBe(true)

      blocks.markResponsive(a)
      expect(cf.isSilent(a)).toBe(false)
    })

    it('keeps its own peer source', () => {
      const cf = over(a)
      expect(cf.over(() => [b, c]).candidates()).toEqual([b, c])
    })
  })
})
