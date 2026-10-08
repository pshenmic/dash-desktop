import {DashCoreSDK} from 'dash-core-sdk'
import {emptyDapi, DapiJSON} from '../preferences/network'
import {Network} from '../types/Network'

const instances = new Map<Network, DashCoreSDK>()
let dapi: DapiJSON = emptyDapi()

export function setCoreDapi(value: DapiJSON): void {
  dapi = value
  instances.clear()
}

// The constructor starts evonode discovery in the background, so one is kept per
// network.
export function coreSDK(network: Network): DashCoreSDK {
  let sdk = instances.get(network)
  if (sdk == null) {
    const own = dapi[network]
    sdk = dapi.mode === 'static' && own.length > 0
      // Typed as a string, but handed as is to a pool that takes and pins a list.
      ? new DashCoreSDK({network, dapiUrl: [...own] as unknown as string})
      : new DashCoreSDK({network})
    instances.set(network, sdk)
  }
  return sdk
}
