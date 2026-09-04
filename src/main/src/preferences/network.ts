import {z} from 'zod'
import {Network} from '../types/Network'

export const PeerModeSchema = z.enum(['dynamic', 'static'])

export type PeerMode = z.infer<typeof PeerModeSchema>

export const NetworkNameSchema = z.enum(['mainnet', 'testnet'])

// Entries read as `host`, `host:port`, `[v6]` or `[v6]:port`.
export const PeerListSchema = z.array(z.string().trim().min(1))

export const PeerOverridesSchema = z.object({
  // Replaces the built-in DNS seeds when non-empty. Mainnet ships exactly one
  // seed and no peer cache, so a resolver that cannot reach it leaves the pools
  // with nothing to dial.
  dnsSeeds: PeerListSchema,
  // Dialled directly.
  peers: PeerListSchema,
  // `ip:port` — a ban matches one socket, not every port a host answers on.
  banned: PeerListSchema.default([]),
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
  prefs => prefs.mode !== 'static' || prefs.mainnet.peers.length > 0 || prefs.testnet.peers.length > 0,
  {message: 'static peer mode requires at least one peer'},
)

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
      mainnet: {dnsSeeds: [...this.mainnet.dnsSeeds], peers: [...this.mainnet.peers], banned: [...this.mainnet.banned]},
      testnet: {dnsSeeds: [...this.testnet.dnsSeeds], peers: [...this.testnet.peers], banned: [...this.testnet.banned]},
    }
  }

  static fromObject(value: unknown): NetworkPreferences {
    const {mode, mainnet, testnet} = NetworkPreferencesSchema.parse(value)
    return new NetworkPreferences(mode, mainnet, testnet)
  }

  static default(): NetworkPreferences {
    return new NetworkPreferences('dynamic', {dnsSeeds: [], peers: [], banned: []}, {dnsSeeds: [], peers: [], banned: []})
  }
}
