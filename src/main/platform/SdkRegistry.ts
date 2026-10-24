import {DashPlatformSDK, GRPCConnectionPool} from 'dash-platform-sdk'
import {ShieldedBuilderWASM} from 'pshenmic-dpp'
import {Network} from '../src/types/Network'

import {NETWORKS} from './constants'
import {P2PQuorumKeyProvider} from './P2PQuorumKeyProvider'
import {Dapi} from './types/messages'
import {SdkSource} from './types/sdk'

// One SDK per network, replaced on a DAPI change.
// `setNetwork` is deliberately never called: it rebuilds the gRPC pool and
// replaces every controller, leaving anything in flight holding swapped-out
// objects. A replaced SDK keeps serving whatever already holds it.
export class SdkRegistry implements SdkSource {
  private readonly sdks = new Map<Network, DashPlatformSDK>()
  private readonly pinnedDapiUrls = new Map<Network, string[]>()
  private readonly quorumKeyProviders = new Map(NETWORKS.map(network => [network, new P2PQuorumKeyProvider(network)]))
  private builder: ShieldedBuilderWASM | null = null
  private warming: Promise<void> | null = null
  private dapi: Dapi = {mode: 'dynamic', mainnet: [], testnet: []}

  setDapi(dapi: Dapi): void {
    this.dapi = dapi
    this.sdks.clear()
  }

  setQuorumKeys(network: Network, keys: Map<string, Uint8Array>): void {
    this.quorumKeyProviders.get(network)?.setKeys(keys)
  }

  setPinnedDapiUrls(network: Network, dapiUrls: string[]): void {
    this.pinnedDapiUrls.set(network, dapiUrls)
    this.sdks.delete(network)
  }

  get(network: Network): DashPlatformSDK {
    const existing = this.sdks.get(network)
    if (existing != null) return existing
    const own = this.dapi[network]
    const dapiUrls = this.dapi.mode === 'static' && own.length > 0 ? own : this.pinnedDapiUrls.get(network)
    const sdk = new DashPlatformSDK({
      network,
      grpc: {dapiUrl: [...dapiUrls ?? []]},
      quorumKeyProvider: this.quorumKeyProviders.get(network),
    })
    // init assigns the builder before its first await; the warmed builder's
    // own init is memoised.
    if (this.builder != null) void sdk.shielded.init(this.builder)
    this.sdks.set(network, sdk)
    return sdk
  }

  activeDapiUrls(network: Network): string[] {
    const pool = this.get(network).grpcPool
    return pool instanceof GRPCConnectionPool ? [...pool.dapiUrls] : []
  }

  getBuilder(): ShieldedBuilderWASM | null {
    return this.builder
  }

  // The Halo2 proving key is built once and the one builder injected into every
  // network's shielded controller. Sharing it across networks is correct rather
  // than a shortcut: the builder carries no network, which enters only through
  // the gRPC pool that reads anchors/nullifiers and broadcasts.
  //
  // ShieldedBuilderWASM memoises the raw builder on a private static, so this
  // would converge without injection — but a dependency's private static is not
  // a contract to rely on.
  warmup(): Promise<void> {
    if (this.warming != null) return this.warming
    this.warming = (async () => {
      const builder = new ShieldedBuilderWASM()
      await builder.init()
      this.builder = builder
      for (const network of NETWORKS) {
        await this.get(network).shielded.init(builder)
      }
    })().catch(err => {
      // Let a later request retry rather than caching the failure forever.
      this.warming = null
      throw err
    })
    return this.warming
  }
}
