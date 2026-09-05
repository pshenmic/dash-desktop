import type {PeerOverrides} from '../types/pool'

export function peerOverridesKey(overrides?: PeerOverrides): string {
  const mode = overrides?.mode ?? 'dynamic'
  return JSON.stringify(mode === 'static'
    ? [mode, overrides?.staticPeers ?? []]
    : [mode, overrides?.dnsSeeds ?? [], overrides?.dynamicPeers ?? []])
}

export function bulkPeerShare(peers: string[] = []): string[] {
  return peers.filter((_, index) => index % 2 === 1)
}
