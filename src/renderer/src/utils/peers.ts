import type {Network, PeerInfo} from '@renderer/api/types'
import {DEFAULT_PEER_PORTS, PEER_UNAVAILABLE_LABEL} from '@renderer/constants/connection'
import type {PeerTableRow, PeerTableSources, PeerTableTab} from '@renderer/types/connection'

function parsePeerEntry(entry: string, network: Network): [string, number] | null {
  const trimmed = entry.trim()
  if (trimmed.length === 0) return null

  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    if (end <= 1) return null
    const host = trimmed.slice(1, end)
    const suffix = trimmed.slice(end + 1)
    if (suffix.length === 0) return [host, DEFAULT_PEER_PORTS[network]]
    if (!suffix.startsWith(':')) return null
    const port = Number(suffix.slice(1))
    return Number.isInteger(port) && port > 0 && port <= 0xffff ? [host, port] : null
  }

  const colonCount = (trimmed.match(/:/g) ?? []).length
  if (colonCount > 1) return [trimmed, DEFAULT_PEER_PORTS[network]]
  if (colonCount === 0) return [trimmed, DEFAULT_PEER_PORTS[network]]

  const separator = trimmed.indexOf(':')
  const host = trimmed.slice(0, separator)
  const port = Number(trimmed.slice(separator + 1))
  if (host.length === 0 || !Number.isInteger(port) || port <= 0 || port > 0xffff) return null
  return [host, port]
}

export function formatPeerAddress(host: string, port: number): string {
  const trimmed = host.trim()
  const unwrapped = trimmed.startsWith('[') && trimmed.endsWith(']')
    ? trimmed.slice(1, -1)
    : trimmed
  return unwrapped.includes(':') ? `[${unwrapped}]:${port}` : `${unwrapped}:${port}`
}

export function formatPeerEntry(entry: string, network: Network): string {
  const parsed = parsePeerEntry(entry, network)
  return parsed === null ? entry.trim() : formatPeerAddress(parsed[0], parsed[1])
}

export function peerIdentity(entry: string, network: Network): string {
  const parsed = parsePeerEntry(entry, network)
  return parsed === null
    ? entry.trim().toLowerCase()
    : `${parsed[0].toLowerCase()}\u0000${parsed[1]}`
}

export function dedupePeerEntries(entries: string[], network: Network): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of entries) {
    const trimmed = entry.trim()
    if (trimmed.length === 0) continue
    const identity = peerIdentity(trimmed, network)
    if (seen.has(identity)) continue
    seen.add(identity)
    result.push(trimmed)
  }
  return result
}

export function appendPeerEntry(entries: string[], entry: string, network: Network): string[] {
  return dedupePeerEntries([...entries, entry], network)
}

export function removePeerEntry(entries: string[], entry: string, network: Network): string[] {
  const removedIdentity = peerIdentity(entry, network)
  return dedupePeerEntries(entries, network)
    .filter(candidate => peerIdentity(candidate, network) !== removedIdentity)
}

export function buildPeerTableRows({
  connectedPeers,
  dynamicPeers,
  staticPeers,
  bannedPeers,
  network,
}: PeerTableSources): Record<PeerTableTab, PeerTableRow[]> {
  const uniqueDynamicPeers = dedupePeerEntries(dynamicPeers, network)
  const dynamicByIdentity = new Map(
    uniqueDynamicPeers.map(entry => [peerIdentity(entry, network), entry]),
  )
  const connectedIdentities = new Set<string>()
  const connectedByIdentity = new Map<string, PeerInfo>()

  const active = connectedPeers.map((peer): PeerTableRow => {
    const address = formatPeerAddress(peer.host, peer.port)
    const identity = peerIdentity(address, network)
    const dynamicEntry = dynamicByIdentity.get(identity) ?? null
    connectedIdentities.add(identity)
    connectedByIdentity.set(identity, peer)
    return {
      id: dynamicEntry === null
        ? `active:connected:${peer.pool}:${identity}`
        : `active:dynamic:${identity}`,
      entry: dynamicEntry ?? address,
      peer: address,
      userAgent: peer.userAgent ?? PEER_UNAVAILABLE_LABEL,
      pingTime: peer.pingMs === null || !Number.isFinite(peer.pingMs)
        ? PEER_UNAVAILABLE_LABEL
        : `${Math.round(peer.pingMs)} ms`,
      pool: peer.pool,
      connected: true,
      configuredList: dynamicEntry === null ? null : 'dynamic',
    }
  })

  for (const entry of uniqueDynamicPeers) {
    const identity = peerIdentity(entry, network)
    if (connectedIdentities.has(identity)) continue
    active.push({
      id: `active:dynamic:${identity}`,
      entry,
      peer: formatPeerEntry(entry, network),
      userAgent: PEER_UNAVAILABLE_LABEL,
      pingTime: PEER_UNAVAILABLE_LABEL,
      pool: null,
      connected: false,
      configuredList: 'dynamic',
    })
  }

  const configuredRows = (
    entries: string[],
    tab: 'static' | 'banned',
  ): PeerTableRow[] => dedupePeerEntries(entries, network).map(entry => {
    const identity = peerIdentity(entry, network)
    const connectedPeer = tab === 'static' ? connectedByIdentity.get(identity) : undefined
    return {
      id: `${tab}:${identity}`,
      entry,
      peer: formatPeerEntry(entry, network),
      userAgent: connectedPeer?.userAgent ?? PEER_UNAVAILABLE_LABEL,
      pingTime: connectedPeer?.pingMs === null
        || connectedPeer?.pingMs === undefined
        || !Number.isFinite(connectedPeer.pingMs)
        ? PEER_UNAVAILABLE_LABEL
        : `${Math.round(connectedPeer.pingMs)} ms`,
      pool: connectedPeer?.pool ?? null,
      connected: connectedPeer !== undefined,
      configuredList: tab,
    }
  })

  return {
    active,
    static: configuredRows(staticPeers, 'static'),
    banned: configuredRows(bannedPeers, 'banned'),
  }
}
