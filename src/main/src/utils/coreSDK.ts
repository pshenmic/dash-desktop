import {DashCoreSDK} from 'dash-core-sdk'
import {Network} from '../types/Network'

const instances = new Map<Network, DashCoreSDK>()

// The constructor starts evonode discovery in the background, so one is kept per
// network — a fresh instance answers its first request against an empty DAPI
// url list.
export function coreSDK(network: Network): DashCoreSDK {
  let sdk = instances.get(network)
  if (sdk == null) {
    sdk = new DashCoreSDK({network})
    instances.set(network, sdk)
  }
  return sdk
}
