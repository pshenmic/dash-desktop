import {DashCoreSDK} from 'dash-core-sdk'
import {EvonodesJSON} from '../preferences/network'
import {Network} from '../types/Network'

const instances = new Map<Network, DashCoreSDK>()
let evonodes: EvonodesJSON = {mode: 'dynamic', mainnet: [], testnet: []}

// Instances are rebuilt rather than updated: the SDK pins a url list passed to
// its constructor, and a discovery round replaces the pool's list wholesale.
export function setCoreEvonodes(value: EvonodesJSON): void {
  evonodes = value
  instances.clear()
}

// The constructor starts evonode discovery in the background, so one is kept per
// network. A static list empty for this network falls back to discovery, as the
// platform pool does.
export function coreSDK(network: Network): DashCoreSDK {
  let sdk = instances.get(network)
  if (sdk == null) {
    const own = evonodes[network]
    if (evonodes.mode === 'static' && own.length > 0) {
      // Typed as a string, but handed as is to a pool that takes and pins a list.
      sdk = new DashCoreSDK({network, dapiUrl: [...own] as unknown as string})
    } else {
      sdk = new DashCoreSDK({network})
      const pool = sdk.grpcConnectionPool
      // Joined only once the first discovery round has swapped its list in.
      if (own.length > 0) void pool.ready().then(() => { pool.dapiUrls = [...new Set([...pool.dapiUrls, ...own])] })
    }
    instances.set(network, sdk)
  }
  return sdk
}
