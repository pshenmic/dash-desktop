import {DashCoreSDK} from 'dash-core-sdk'
import {emptyDapi, DapiJSON} from '../preferences/network'
import {Network} from '../types/Network'

const instances = new Map<Network, DashCoreSDK>()
// null: the SDK discovers evonodes from its own seed nodes.
const evonodeDapiUrls = new Map<Network, string[] | null>()
let dapi: DapiJSON = emptyDapi()

export function setCoreDapi(value: DapiJSON): void {
  dapi = value
  instances.clear()
}

export function setCoreDapiUrls(network: Network, dapiUrls: string[] | null): void {
  evonodeDapiUrls.set(network, dapiUrls)
  instances.delete(network)
}

// Before the first evonode list arrives the SDK is built on no urls at all,
// unless the platform worker fell back to the SDK's own seeds.
export function coreSDK(network: Network): DashCoreSDK {
  let sdk = instances.get(network)
  if (sdk == null) {
    const own = dapi[network]
    const pinned = evonodeDapiUrls.get(network)
    const dapiUrls = dapi.mode === 'static' && own.length > 0 ? own : pinned === null ? null : pinned ?? []
    // Typed as a string, but handed as is to a pool that takes and pins a list.
    sdk = new DashCoreSDK({network, dapiUrl: dapiUrls == null ? undefined : [...dapiUrls] as unknown as string})
    instances.set(network, sdk)
  }
  return sdk
}
