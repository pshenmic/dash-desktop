import {AddrInfo, Peer} from 'dash-core-p2p'

// dash-core-p2p parses its own `peers` option inside the Pool constructor and
// throws on a bad entry, which in this process means one typo in preferences
// takes down the whole child. Parsing here lets the caller drop the entry.
export function parsePeerAddress(input: string, defaultPort: number): AddrInfo | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null

  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    if (end === -1) return null
    const v6 = trimmed.slice(1, end)
    const rest = trimmed.slice(end + 1)
    if (v6.length === 0) return null
    if (rest.length === 0) return {ip: {v6}, port: defaultPort}
    if (!rest.startsWith(':')) return null
    const port = toPort(rest.slice(1))
    return port == null ? null : {ip: {v6}, port}
  }

  const colons = (trimmed.match(/:/g) ?? []).length
  // A bare v6 literal carries several, so only a single colon can be a port.
  if (colons > 1) return {ip: {v6: trimmed}, port: defaultPort}

  if (colons === 1) {
    const idx = trimmed.indexOf(':')
    const host = trimmed.slice(0, idx)
    const port = toPort(trimmed.slice(idx + 1))
    if (host.length === 0 || port == null) return null
    return {ip: {v4: host}, port}
  }

  return {ip: {v4: trimmed}, port: defaultPort}
}

function toPort(raw: string): number | null {
  const port = Number(raw)
  if (!Number.isInteger(port) || port <= 0 || port > 0xffff) return null
  return port
}

export function dialTarget(addr: AddrInfo, defaultPort: number): string {
  return `${addr.ip.v4 ?? addr.ip.v6}:${addr.port ?? defaultPort}`
}

export function peerListEntry(addr: AddrInfo, defaultPort: number): string {
  const port = addr.port ?? defaultPort
  return addr.ip.v4 != null ? `${addr.ip.v4}:${port}` : `[${addr.ip.v6}]:${port}`
}

export function entryTarget(entry: string, defaultPort: number): string {
  const addr = parsePeerAddress(entry, defaultPort)
  return addr == null ? entry.trim() : dialTarget(addr, defaultPort)
}

export function peerTarget(peer: Peer): string {
  return `${peer.host}:${peer.port}`
}

export function bannedSet(entries: string[]): ReadonlySet<string> {
  return new Set(entries.map(entry => entry.replace(/[[\]]/g, '')))
}

export function isDnsSeedHost(input: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(input.trim())
}
