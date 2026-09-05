// One node, one socket, across every pool in this process.
//
// dash-core-p2p keys an address by a hash of both ip halves and the port, but
// dials the v4 half alone — so one node reached through two gossip entries is
// two entries and two sockets. The two pools gossip independently on top of
// that, so both find the same nodes. Core drops both connections when it sees
// the duplicate, which is why the pools coordinate here rather than each
// deduping its own book.
//
// Claims are held by the socket, not by the pool: a pool asking twice for one
// target is the same duplicate as two pools asking once.
export class PeerRegistry {
  private readonly claims = new Map<string, {owner: object; holder: object}>()

  // True when this socket holds the target afterwards. Anything else — another
  // socket of this pool, or one of the other pool — is told no and hangs up.
  claim(target: string, owner: object, holder: object): boolean {
    const held = this.claims.get(target)
    if (held == null) {
      this.claims.set(target, {owner, holder})
      return true
    }
    return held.holder === holder
  }

  // Only the socket holding it may free it, so a losing dial cannot release the
  // connection that beat it.
  release(target: string, holder: object): void {
    if (this.claims.get(target)?.holder === holder) this.claims.delete(target)
  }

  // Answers the pool asking whether it may dial: its own claim is not in its way.
  heldByOther(target: string, owner: object): boolean {
    const held = this.claims.get(target)
    return held != null && held.owner !== owner
  }

  // Called with everything the owner still has a socket for, so a target whose
  // peer vanished without a disconnect event is free again.
  keepOnly(owner: object, targets: ReadonlySet<string>): void {
    for (const [target, held] of this.claims) {
      if (held.owner === owner && !targets.has(target)) this.claims.delete(target)
    }
  }
}
