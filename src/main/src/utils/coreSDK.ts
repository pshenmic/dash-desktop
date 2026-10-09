import {DashCoreSDK} from 'dash-core-sdk'
import {emptyDapi, DapiJSON} from '../preferences/network'
import {Network} from '../types/Network'

const instances = new Map<Network, DashCoreSDK>()
const evonodeDapiUrls = new Map<Network, string[]>()
let dapi: DapiJSON = emptyDapi()

export function setCoreDapi(value: DapiJSON): void {
  dapi = value
  instances.clear()
}

// The evonodes the platform worker probed and pinned its own SDK to.
export function setCoreDapiUrls(network: Network, dapiUrls: string[]): void {
  evonodeDapiUrls.set(network, dapiUrls)
  instances.delete(network)
}

// Until the first evonode list arrives — a first launch — the SDK runs its own
// seed discovery.
export function coreSDK(network: Network): DashCoreSDK {
  let sdk = instances.get(network)
  if (sdk == null) {
    const own = dapi[network]
    const dapiUrls = dapi.mode === 'static' && own.length > 0 ? own : evonodeDapiUrls.get(network)
    sdk = dapiUrls != null
      // Typed as a string, but handed as is to a pool that takes and pins a list.
      ? new DashCoreSDK({network, dapiUrl: [...dapiUrls] as unknown as string})
      : new DashCoreSDK({network})
    instances.set(network, sdk)
  }
  return sdk
}
