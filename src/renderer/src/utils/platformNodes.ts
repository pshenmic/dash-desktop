import type {DapiUrlStatus, Network, PeerMode} from '@renderer/api/types'
import {
  PLATFORM_NODE_EMPTY_LABELS,
  PLATFORM_NODE_INVALID_URL_MESSAGE,
  PLATFORM_NODE_STATE_LABELS,
  PLATFORM_NODE_UNAVAILABLE_LABEL,
} from '@renderer/constants/platformNodes'
import type {PlatformNodeRow, PlatformNodeTableTab} from '@renderer/types/platformNodes'

export function getPlatformNodeEmptyLabel(network: Network | null, loading: boolean, tab: PlatformNodeTableTab): string {
  if (network === null) return PLATFORM_NODE_EMPTY_LABELS.noWallet
  if (loading) return PLATFORM_NODE_EMPTY_LABELS.loading
  return PLATFORM_NODE_EMPTY_LABELS[tab]
}

export function platformNodeIdentity(input: string): string {
  const trimmed = input.trim()
  try {
    return new URL(trimmed).href
  } catch {
    return trimmed
  }
}

export function appendPlatformNode(entries: string[], input: string): string[] {
  const trimmed = input.trim()
  try {
    if (new URL(trimmed).protocol !== 'https:') throw new Error()
  } catch {
    throw new Error(PLATFORM_NODE_INVALID_URL_MESSAGE)
  }

  const identity = platformNodeIdentity(trimmed)
  const saved = entries.map(entry => entry.trim())
  return saved.some(entry => platformNodeIdentity(entry) === identity)
    ? saved
    : [...saved, trimmed]
}

export function removePlatformNode(entries: string[], input: string): string[] {
  const identity = platformNodeIdentity(input)
  return entries.map(entry => entry.trim())
    .filter(entry => platformNodeIdentity(entry) !== identity)
}

export function buildPlatformNodeRows(
  activeNodes: DapiUrlStatus[],
  staticNodes: string[],
  mode: PeerMode | null,
): Record<PlatformNodeTableTab, PlatformNodeRow[]> {
  const activeByIdentity = new Map<string, DapiUrlStatus>()
  for (const node of activeNodes) {
    const identity = platformNodeIdentity(node.dapiUrl)
    if (!activeByIdentity.has(identity)) activeByIdentity.set(identity, node)
  }

  const buildRow = (
    entry: string,
    tab: PlatformNodeTableTab,
    node: DapiUrlStatus | undefined,
  ): PlatformNodeRow => {
    const pingMs = node?.pingMs
    const hasPing = pingMs !== null && pingMs !== undefined && Number.isFinite(pingMs)
    const available = node !== undefined
      && node.error === null
      && (hasPing || node.driveVersion !== null || node.blockHeight !== null)
    let status: string = PLATFORM_NODE_STATE_LABELS.saved
    if (available) {
      status = PLATFORM_NODE_STATE_LABELS.available
      if (tab === 'static' && mode === 'dynamic') status = PLATFORM_NODE_STATE_LABELS.automatic
    } else if (node !== undefined) {
      status = PLATFORM_NODE_STATE_LABELS.noResponse
    } else if (mode === 'static') {
      status = PLATFORM_NODE_STATE_LABELS.inactive
    }
    return {
      id: `${tab}:${platformNodeIdentity(entry)}`,
      entry,
      url: entry,
      driveVersion: node?.driveVersion ?? PLATFORM_NODE_UNAVAILABLE_LABEL,
      pingTime: hasPing ? `${Math.round(pingMs)} ms` : PLATFORM_NODE_UNAVAILABLE_LABEL,
      blockHeight: node?.blockHeight?.toLocaleString() ?? PLATFORM_NODE_UNAVAILABLE_LABEL,
      status,
      available,
      proTxHash: node?.proTxHash ?? null,
      error: node?.error ?? null,
    }
  }

  const savedByIdentity = new Map<string, string>()
  for (const entry of staticNodes) {
    const trimmed = entry.trim()
    const identity = platformNodeIdentity(trimmed)
    if (!savedByIdentity.has(identity)) savedByIdentity.set(identity, trimmed)
  }

  return {
    active: [...activeByIdentity.values()].map(node => buildRow(node.dapiUrl, 'active', node)),
    static: [...savedByIdentity].map(([identity, entry]) => buildRow(entry, 'static', activeByIdentity.get(identity))),
  }
}
