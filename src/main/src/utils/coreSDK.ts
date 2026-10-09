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

export function setCoreDapiUrls(network: Network, dapiUrls: string[]): void {
  evonodeDapiUrls.set(network, dapiUrls)
  instances.delete(network)
}

// Before the first evonode list arrives the SDK is built on no urls at all: given
// none, it would run a discovery of its own against dead seed nodes.
export function coreSDK(network: Network): DashCoreSDK {
  let sdk = instances.get(network)
  if (sdk == null) {
    const own = dapi[network]
    const dapiUrls = dapi.mode === 'static' && own.length > 0 ? own : evonodeDapiUrls.get(network) ?? []
    // Typed as a string, but handed as is to a pool that takes and pins a list.
    sdk = new DashCoreSDK({network, dapiUrl: [...dapiUrls] as unknown as string})
    instances.set(network, sdk)
  }
  return sdk
}
