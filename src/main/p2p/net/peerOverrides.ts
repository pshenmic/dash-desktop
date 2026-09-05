import type {PeerOverrides} from '../types/pool'

// A pool reads these once, at construction, so the running session has to be
// rebuilt when they change. Commands carry a fresh object every time, hence a
// value comparison rather than an identity one. Only what the running mode
// actually dials counts: editing the list the other mode uses would otherwise
// tear down a synced pool to rebuild it identically. Bans are absent because
// they reach a running pool in place.
export function peerOverridesKey(overrides?: PeerOverrides): string {
  const mode = overrides?.mode ?? 'dynamic'
  return JSON.stringify(mode === 'static'
    ? [mode, overrides?.staticPeers ?? []]
    : [mode, overrides?.dnsSeeds ?? [], overrides?.dynamicPeers ?? []])
}

// Both pools run in dynamic mode, and a node dialled twice from one host drops
// both connections — so the user's peers are shared out rather than handed to
// each. The lock pool is built with all of them because in rpc mode it is the
// only pool there is, and it lends this share out when the bulk layer starts.
// Every second entry: the first stays where broadcast and lock watching are.
export function bulkPeerShare(peers: string[] = []): string[] {
  return peers.filter((_, index) => index % 2 === 1)
}
