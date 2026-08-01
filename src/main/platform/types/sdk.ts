import type {DashPlatformSDK} from 'dash-platform-sdk'
import type {Network} from '../../src/types'

// What the dispatcher needs from an SDK source. Narrow on purpose: it is the
// seam the network-isolation test stubs.
export interface SdkSource {
  get: (network: Network) => DashPlatformSDK
  warmup: () => Promise<void>
}
