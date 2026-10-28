import {DashPlatformSDK, GRPCConnectionPool} from 'dash-platform-sdk'
import {ShieldedBuilderWASM} from 'pshenmic-dpp'
import {Network} from '../src/types/Network'
import {Logger} from '../src/utils/logger'

import {DAPI_POOL_READY, DAPI_REPROBE_MS, NETWORKS} from './constants'
import {reachableDapiUrls} from './operations/dapi'
import {P2PQuorumKeyProvider} from './P2PQuorumKeyProvider'
import {Dapi, PlatformEvent} from './types/messages'
import {SdkSource} from './types/sdk'

const log = new Logger('platform')

// One SDK per network, replaced on a DAPI change and otherwise never mutated.
// `setNetwork` is deliberately never called: it rebuilds the gRPC pool and
// replaces every controller, leaving anything in flight holding swapped-out
// objects. A replaced SDK keeps serving whatever already holds it.
//
// Before the first evonode list is probed the SDK is built on no urls at all,
// unless main gave up waiting for it and fell back to the SDK's own seeds.
export class SdkRegistry implements SdkSource {
  private readonly sdks = new Map<Network, DashPlatformSDK>()
  // null: the SDK discovers evonodes from its own seed nodes.
  private readonly pinnedDapiUrls = new Map<Network, string[] | null>()
  // The list each network was last asked to probe, so only the latest is retried.
  private readonly latestDapiUrls = new Map<Network, string[]>()
  private readonly refills = new Set<Network>()
  private readonly quorumKeyProviders = new Map(NETWORKS.map(network => [network, new P2PQuorumKeyProvider(network)]))
  private builder: ShieldedBuilderWASM | null = null
  private warming: Promise<void> | null = null
  private dapi: Dapi = {mode: 'dynamic', mainnet: [], testnet: []}

  constructor(private readonly emit: (event: PlatformEvent) => void) {}

  setDapi(dapi: Dapi): void {
    this.dapi = dapi
    this.sdks.clear()
  }

  setQuorumKeys(network: Network, keys: Map<string, Uint8Array>): void {
    this.quorumKeyProviders.get(network)?.setKeys(keys)
  }

  get(network: Network): DashPlatformSDK {
    const existing = this.sdks.get(network)
    if (existing != null) return existing
    const own = this.dapi[network]
    const pinned = this.pinnedDapiUrls.get(network)
    const dapiUrls = this.dapi.mode === 'static' && own.length > 0 ? own : pinned === null ? null : pinned ?? []
    const sdk = new DashPlatformSDK({
      network,
      grpc: {dapiUrl: dapiUrls == null ? undefined : [...dapiUrls]},
      quorumKeyProvider: this.quorumKeyProviders.get(network),
    })
    // init assigns the builder before its first await; the warmed builder's
    // own init is memoised.
    if (this.builder != null) void sdk.shielded.init(this.builder)
    this.sdks.set(network, sdk)
    return sdk
  }

  // A list probed later still replaces the seeds.
  useSeedNodes(network: Network): void {
    if (this.pinnedDapiUrls.has(network)) return
    log.warn(`${network}: no evonode from the p2p masternode list yet, discovering from the SDK's seed nodes`)
    this.pinnedDapiUrls.set(network, null)
    this.sdks.delete(network)
  }

  setEvonodeDapiUrls(network: Network, dapiUrls: string[]): void {
    this.latestDapiUrls.set(network, dapiUrls)
    this.probe(network, dapiUrls)
      .then(reachable => {
        if (reachable.length === 0) throw new Error(`none of ${dapiUrls.length} evonode(s) answered`)
      })
      .catch(err => {
        if (this.latestDapiUrls.get(network) !== dapiUrls) return
        log.warn(`${network}: no reachable evonode, probing again in ${DAPI_REPROBE_MS / 1000}s:`, err)
        setTimeout(() => {
          if (this.latestDapiUrls.get(network) === dapiUrls) this.setEvonodeDapiUrls(network, dapiUrls)
        }, DAPI_REPROBE_MS).unref?.()
      })
  }

  // The SDK lifts a ban only after a request succeeds, which none can once every
  // node is banned; a fresh probe builds a pool without them.
  refillBannedPool(network: Network): void {
    if ((this.dapi.mode === 'static' && this.dapi[network].length > 0) || this.refills.has(network)) return
    const dapiUrls = this.latestDapiUrls.get(network)
    log.warn(`${network}: every evonode is banned, refilling the pool`)
    if (dapiUrls == null) {
      this.sdks.delete(network)
      return
    }
    this.refills.add(network)
    void this.probe(network, dapiUrls).finally(() => this.refills.delete(network))
  }

  // Pins the first DAPI_POOL_READY to answer, then every one that did.
  private async probe(network: Network, dapiUrls: string[]): Promise<string[]> {
    log.info(`${network}: probing ${dapiUrls.length} evonode(s)`)
    const started = Date.now()
    const pin = (reachable: string[]): void => {
      log.info(`${network}: pinned to ${reachable.length} of ${dapiUrls.length} evonode(s) in ${Date.now() - started}ms: ${reachable.join(', ')}`)
      this.pinnedDapiUrls.set(network, reachable)
      this.sdks.delete(network)
      this.emit({type: 'pinnedDapiUrls', network, dapiUrls: reachable})
    }
    const reachable = await reachableDapiUrls(dapiUrls, network, pin)
    if (reachable.length > 0 && reachable.length !== DAPI_POOL_READY) pin(reachable)
    return reachable
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
