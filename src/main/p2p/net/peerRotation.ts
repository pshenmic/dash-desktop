import type {Peer} from 'dash-core-p2p'

// Which peer to ask next, and the memory of who went silent. Peer sets are
// insertion ordered, so without this the same unresponsive peers head every
// request and each one pays a full timeout before anyone else is reached.
//
// `source` is read per call rather than captured: the pool's sets are mutated
// in place as peers connect and drop.
export class PeerRotation {
  private readonly silent: Set<Peer>

  constructor(private readonly source: () => Iterable<Peer>, sharedSilent?: Set<Peer>) {
    this.silent = sharedSilent ?? new Set()
  }

  // A second view over a different peer set, sharing the silence memory: a peer
  // that stopped answering cf* requests is the same socket that will not serve
  // a block, even though the two draw on different pools.
  over(source: () => Iterable<Peer>): PeerRotation {
    return new PeerRotation(source, this.silent)
  }

  // Best first: never-tried and responsive, then merely never-tried, then
  // everyone. `tried` is cleared once exhausted so a request can keep retrying
  // against a pool smaller than its race width.
  candidates(tried: Set<Peer> = new Set()): Peer[] {
    const all = [...this.source()]
    const fresh = all.filter(p => !tried.has(p) && !this.silent.has(p))
    if (fresh.length > 0) return fresh

    const untried = all.filter(p => !tried.has(p))
    if (untried.length > 0) return untried

    tried.clear()
    this.silent.clear()
    return all
  }

  // Same order, capped, for callers that race a fixed width rather than
  // dispatching to everything available.
  pick(limit: number, tried?: Set<Peer>): Peer[] {
    return this.candidates(tried).slice(0, limit)
  }

  first(exclude: Set<Peer>): Peer | undefined {
    for (const p of this.source()) if (!exclude.has(p) && !this.silent.has(p)) return p
    for (const p of this.source()) if (!exclude.has(p)) return p
    return undefined
  }

  markSilent(peers: Iterable<Peer>): void {
    for (const p of peers) this.silent.add(p)
  }

  // Any answer clears the mark — the set is about silence, not correctness, so
  // an unusable response still proves the peer is talking.
  markResponsive(peer: Peer): void {
    this.silent.delete(peer)
  }

  forget(peer: Peer): void {
    this.silent.delete(peer)
  }

  isSilent(peer: Peer): boolean {
    return this.silent.has(peer)
  }

  get silentCount(): number {
    return this.silent.size
  }
}
