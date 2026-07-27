import {DashPlatformSDK} from 'dash-platform-sdk'
import {ShieldedBuilderWASM} from 'pshenmic-dpp'
import {Network} from '../src/types'

export const NETWORKS: readonly Network[] = ['mainnet', 'testnet']

// What the dispatcher needs from an SDK source. Narrow on purpose: it is the
// seam the network-isolation test stubs.
export interface SdkSource {
  get: (network: Network) => DashPlatformSDK
  warmup: () => Promise<void>
}

// One SDK per network, constructed once and never mutated. `setNetwork` is not
// called anywhere in this directory: it rebuilds the gRPC pool and replaces
// every controller, so anything already in flight is left holding objects that
// were swapped out from under it (finding X-5).
export class SdkRegistry implements SdkSource {
  private readonly sdks = new Map<Network, DashPlatformSDK>()
  private builder: ShieldedBuilderWASM | null = null
  private warming: Promise<void> | null = null

  get(network: Network): DashPlatformSDK {
    const existing = this.sdks.get(network)
    if (existing != null) return existing
    const sdk = new DashPlatformSDK({network})
    this.sdks.set(network, sdk)
    return sdk
  }

  getBuilder(): ShieldedBuilderWASM | null {
    return this.builder
  }

  // Builds the Halo2 proving key once and injects that one builder into every
  // network's shielded controller. The builder carries no network — nothing in
  // its signature set takes one, and network enters only through the gRPC pool
  // that reads anchors and nullifiers and broadcasts — so one instance serving
  // both networks is correct, not a shortcut.
  //
  // ShieldedBuilderWASM also memoises the raw builder on a private static, so
  // this would converge without injection. Relying on a dependency's private
  // static is not a contract. Inject.
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
