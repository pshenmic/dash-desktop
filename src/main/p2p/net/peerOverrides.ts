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
