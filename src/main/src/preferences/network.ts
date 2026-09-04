import {z} from 'zod'
import {Network} from '../types/Network'

export const PeerModeSchema = z.enum(['dynamic', 'static'])

export type PeerMode = z.infer<typeof PeerModeSchema>

export const NetworkNameSchema = z.enum(['mainnet', 'testnet'])

const StringListSchema = z.array(z.string().trim().min(1))

// Entries read as `host`, `host:port`, `[v6]` or `[v6]:port`. Which of those an
// endpoint accepts is checked there, not here: a schema strict enough to refuse
// one would take the whole network section down with it — see Preferences.migrate.
export const PeerListSchema = StringListSchema

// Hostnames. dns.resolve turns one into several addresses, all on the network's
// default port, so a seed never carries a port of its own.
export const DnsSeedListSchema = StringListSchema

export const PeerOverridesSchema = z.object({
  // Replaces the built-in seeds when non-empty, rather than adding to them.
  // Mainnet ships exactly one seed and no peer cache, so a resolver that cannot
  // reach it leaves the pools with nothing to dial.
  dnsSeeds: DnsSeedListSchema.default([]),
  // Everything static mode dials: no DNS, no gossip, no fallbacks.
  staticPeers: PeerListSchema.default([]),
  // Dialled in dynamic mode on top of DNS and gossip, never instead of them.
  dynamicPeers: PeerListSchema.default([]),
  // `ip:port` — a ban matches one socket, not every port a host answers on.
  bannedPeers: PeerListSchema.default([]),
})

export type PeerOverridesJSON = z.infer<typeof PeerOverridesSchema>

// What one pool is built from: the app-wide mode plus the entry for the network
// it runs on.
export interface PeerSettings extends PeerOverridesJSON {
  mode: PeerMode
}

export const NetworkPreferencesSchema = z.object({
  // One setting for the whole app — a peer list is per network, but which kind
  // of peer discovery the wallet does is not.
  mode: PeerModeSchema.default('dynamic'),
  mainnet: PeerOverridesSchema,
  testnet: PeerOverridesSchema,
}).refine(
  prefs => prefs.mode !== 'static' || prefs.mainnet.staticPeers.length > 0 || prefs.testnet.staticPeers.length > 0,
  {message: 'static peer mode requires at least one peer'},
)

// v7 wrote `peers` and `banned` for what are now `staticPeers` and
// `bannedPeers`. The schema defaults both new names, so without this a pinned
// peer list and every ban vanish silently on the first launch after an update.
export function renameLegacyPeerFields(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw

  const section = {...raw as Record<string, unknown>}
  for (const name of ['mainnet', 'testnet']) {
    const entry = section[name]
    if (entry == null || typeof entry !== 'object') continue
    const {peers, banned, ...rest} = entry as Record<string, unknown>
    section[name] = {
      ...rest,
      staticPeers: rest.staticPeers ?? peers ?? [],
      bannedPeers: rest.bannedPeers ?? banned ?? [],
    }
  }

  return section
}

export type NetworkPreferencesJSON = z.infer<typeof NetworkPreferencesSchema>

export class NetworkPreferences {
  mode: PeerMode
  mainnet: PeerOverridesJSON
  testnet: PeerOverridesJSON

  constructor(mode: PeerMode, mainnet: PeerOverridesJSON, testnet: PeerOverridesJSON) {
    this.mode = mode
    this.mainnet = mainnet
    this.testnet = testnet
  }

  // A network the user pinned no peer for cannot honour static mode; the pool
  // falls back to discovery and says so in its status.
  settingsFor(network: Network): PeerSettings {
    return {mode: this.mode, ...this[network]}
  }

  toJSON(): NetworkPreferencesJSON {
    return {
      mode: this.mode,
      mainnet: copyOverrides(this.mainnet),
      testnet: copyOverrides(this.testnet),
    }
  }

  static fromObject(value: unknown): NetworkPreferences {
    const {mode, mainnet, testnet} = NetworkPreferencesSchema.parse(value)
    return new NetworkPreferences(mode, mainnet, testnet)
  }

  static default(): NetworkPreferences {
    return new NetworkPreferences('dynamic', emptyOverrides(), emptyOverrides())
  }
}

function copyOverrides(overrides: PeerOverridesJSON): PeerOverridesJSON {
  return {
    dnsSeeds: [...overrides.dnsSeeds],
    staticPeers: [...overrides.staticPeers],
    dynamicPeers: [...overrides.dynamicPeers],
    bannedPeers: [...overrides.bannedPeers],
  }
}

function emptyOverrides(): PeerOverridesJSON {
  return {dnsSeeds: [], staticPeers: [], dynamicPeers: [], bannedPeers: []}
}
