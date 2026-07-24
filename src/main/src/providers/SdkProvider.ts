import {DashPlatformSDK} from 'dash-platform-sdk'
import {DashCoreSDK} from 'dash-core-sdk'
import {Network} from '../types'

// Lazily constructs and caches one SDK instance per network. Replaces the
// previous shared-singleton + `setNetwork()` pattern, which mutated network
// state on a single shared object and raced across concurrent per-wallet
// calls. Each network gets its own long-lived gRPC/DAPI client.
export class SdkProvider {
  private readonly platformSDKs = new Map<Network, DashPlatformSDK>()
  private readonly coreSDKs = new Map<Network, DashCoreSDK>()

  getPlatformSDK(network: Network): DashPlatformSDK {
    let sdk = this.platformSDKs.get(network)
    if (sdk == null) {
      sdk = new DashPlatformSDK({network})
      this.platformSDKs.set(network, sdk)
    }
    return sdk
  }

  getCoreSDK(network: Network): DashCoreSDK {
    let sdk = this.coreSDKs.get(network)
    if (sdk == null) {
      sdk = new DashCoreSDK({network})
      this.coreSDKs.set(network, sdk)
    }
    return sdk
  }
}
