import {DashPlatformSDK} from 'dash-platform-sdk'
import {ShieldedBuilderWASM} from 'pshenmic-dpp'
import {Network} from '../src/types/Network'

import {NETWORKS} from './constants'
import {SdkSource} from './types/sdk'

// One SDK per network, constructed once and never mutated. `setNetwork` is
// deliberately never called: it rebuilds the gRPC pool and replaces every
// controller, leaving anything in flight holding swapped-out objects.
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
