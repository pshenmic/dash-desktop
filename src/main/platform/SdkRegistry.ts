import {createClient, DashPlatformSDK, GRPCConnectionPool, GRPCPool} from 'dash-platform-sdk'
import {ShieldedBuilderWASM} from 'pshenmic-dpp'
import {Network} from '../src/types/Network'

import {NETWORKS} from './constants'
import {Evonodes} from './types/messages'
import {SdkSource} from './types/sdk'

// One SDK per network, constructed once and never mutated. `setNetwork` is
// deliberately never called: it rebuilds the gRPC pool and replaces every
// controller, leaving anything in flight holding swapped-out objects.
export class SdkRegistry implements SdkSource {
  private readonly sdks = new Map<Network, DashPlatformSDK>()
  private builder: ShieldedBuilderWASM | null = null
  private warming: Promise<void> | null = null
  private evonodes: Evonodes = {mode: 'dynamic', mainnet: [], testnet: []}

  setEvonodes(evonodes: Evonodes): void {
    this.evonodes = evonodes
  }

  // Our own pool rather than `setGRPCPool`, which replaces every controller
  // just as `setNetwork` does; an evonode change only alters which url is picked.
  get(network: Network): DashPlatformSDK {
    const existing = this.sdks.get(network)
    if (existing != null) return existing
    const discovery = new GRPCConnectionPool(network)
    const pool: GRPCPool = {
      network,
      getClient: abortController => createClient(this.pickEvonode(network, discovery), abortController),
    }
    const sdk = new DashPlatformSDK({network, grpc: {pool}})
    this.sdks.set(network, sdk)
    return sdk
  }

  // A static list empty for this network falls back to discovery, as p2p
  // static mode does.
  private pickEvonode(network: Network, discovery: GRPCConnectionPool): string {
    const own = this.evonodes[network]
    const urls = this.evonodes.mode === 'static' && own.length > 0 ? own : [...discovery.dapiUrls, ...own]
    return urls[Math.floor(Math.random() * urls.length)]
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
