import {DashPlatformSDK, GRPCConnectionPool} from 'dash-platform-sdk'
import {ShieldedBuilderWASM} from 'pshenmic-dpp'
import {Network} from '../src/types/Network'
import {Logger} from '../src/utils/logger'

import {NETWORKS} from './constants'
import {reachableDapiUrls} from './operations/dapi'
import {Dapi, PlatformEvent} from './types/messages'
import {SdkSource} from './types/sdk'

const log = new Logger('platform')

// One SDK per network, replaced on a DAPI change and otherwise never mutated.
// `setNetwork` is deliberately never called: it rebuilds the gRPC pool and
// replaces every controller, leaving anything in flight holding swapped-out
// objects. A replaced SDK keeps serving whatever already holds it.
//
// Until the first evonode list is probed — a first launch — the SDK runs its own
// seed discovery.
export class SdkRegistry implements SdkSource {
  private readonly sdks = new Map<Network, DashPlatformSDK>()
  private readonly pinnedDapiUrls = new Map<Network, string[]>()
  private builder: ShieldedBuilderWASM | null = null
  private warming: Promise<void> | null = null
  private dapi: Dapi = {mode: 'dynamic', mainnet: [], testnet: []}

  constructor(private readonly emit: (event: PlatformEvent) => void) {}

  setDapi(dapi: Dapi): void {
    this.dapi = dapi
    this.sdks.clear()
  }

  get(network: Network): DashPlatformSDK {
    const existing = this.sdks.get(network)
    if (existing != null) return existing
    const own = this.dapi[network]
    const dapiUrls = this.dapi.mode === 'static' && own.length > 0 ? own : this.pinnedDapiUrls.get(network)
    const sdk = dapiUrls != null
      ? new DashPlatformSDK({network, grpc: {dapiUrl: [...dapiUrls]}})
      : new DashPlatformSDK({network})
    // init assigns the builder before its first await; the warmed builder's
    // own init is memoised.
    if (this.builder != null) void sdk.shielded.init(this.builder)
    this.sdks.set(network, sdk)
    return sdk
  }

  setEvonodeDapiUrls(network: Network, dapiUrls: string[]): void {
    log.info(`${network}: probing ${dapiUrls.length} evonode(s)`)
    const started = Date.now()
    reachableDapiUrls(dapiUrls, network)
      .then(reachable => {
        if (reachable.length === 0) throw new Error(`none of ${dapiUrls.length} evonode(s) answered`)
        log.info(`${network}: pinned to ${reachable.length} of ${dapiUrls.length} evonode(s) in ${Date.now() - started}ms: ${reachable.join(', ')}`)
        this.pinnedDapiUrls.set(network, reachable)
        this.sdks.delete(network)
        this.emit({type: 'pinnedDapiUrls', network, dapiUrls: reachable})
      })
      .catch(err => log.warn(`${network}: no reachable evonode:`, err))
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
