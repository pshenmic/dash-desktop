import {z} from 'zod'

export const PeerOverridesSchema = z.object({
  // Replaces the built-in DNS seeds when non-empty. Mainnet ships exactly one
  // seed and no peer cache, so a resolver that cannot reach it leaves the pools
  // with nothing to dial.
  dnsSeeds: z.array(z.string().trim().min(1)),
  // Dialled directly, as `host`, `host:port`, `[v6]` or `[v6]:port`.
  peers: z.array(z.string().trim().min(1)),
})

export type PeerOverridesJSON = z.infer<typeof PeerOverridesSchema>

export const NetworkPreferencesSchema = z.object({
  mainnet: PeerOverridesSchema,
  testnet: PeerOverridesSchema,
})

export type NetworkPreferencesJSON = z.infer<typeof NetworkPreferencesSchema>

export class NetworkPreferences {
  mainnet: PeerOverridesJSON
  testnet: PeerOverridesJSON

  constructor(mainnet: PeerOverridesJSON, testnet: PeerOverridesJSON) {
    this.mainnet = mainnet
    this.testnet = testnet
  }

  toJSON(): NetworkPreferencesJSON {
    return {
      mainnet: {dnsSeeds: [...this.mainnet.dnsSeeds], peers: [...this.mainnet.peers]},
      testnet: {dnsSeeds: [...this.testnet.dnsSeeds], peers: [...this.testnet.peers]},
    }
  }

  static fromObject(value: unknown): NetworkPreferences {
    const {mainnet, testnet} = NetworkPreferencesSchema.parse(value)
    return new NetworkPreferences(mainnet, testnet)
  }

  static default(): NetworkPreferences {
    return new NetworkPreferences({dnsSeeds: [], peers: []}, {dnsSeeds: [], peers: []})
  }
}