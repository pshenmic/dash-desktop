import type {PeerOverrides} from '../types/pool'

// A pool reads these once, at construction, so the running session has to be
// rebuilt when they change. Commands carry a fresh object every time, hence a
// value comparison rather than an identity one.
export function peerOverridesKey(overrides?: PeerOverrides): string {
  return JSON.stringify([
    overrides?.mode ?? 'dynamic',
    overrides?.dnsSeeds ?? [],
    overrides?.peers ?? [],
  ])
}
