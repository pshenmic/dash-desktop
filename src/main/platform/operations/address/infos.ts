import {AddressInfo, PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'

type Payload = PlatformOperations['addressInfos']['payload']
type Result = PlatformOperations['addressInfos']['result']

// The batch call is one round trip; the per-address fallback exists because a
// single unknown address used to fail the whole batch. Addresses that answer
// neither way are returned as `missing` rather than omitted, so the caller can
// tell "no balance" from "never got an answer" (finding R-4).
export async function addressInfos(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {addresses} = payload
  if (addresses.length === 0) return {infos: [], missing: []}

  const {sdk, network} = ctx
  try {
    const batch = await sdk.platformAddresses.getAddressesInfos(addresses)
    const infos = batch.map(info => ({
      address: info.address.toBech32m(network),
      balance: info.balance,
      nonce: info.nonce,
    }))
    const seen = new Set(infos.map(info => info.address))
    return {infos, missing: addresses.filter(address => !seen.has(address))}
  } catch (e) {
    console.warn('[platform] batch address info failed, falling back per address:', e)
  }

  const settled = await Promise.allSettled(
    addresses.map(address => sdk.platformAddresses.getAddressInfo(address)),
  )
  const infos: AddressInfo[] = []
  const missing: string[] = []
  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      infos.push({address: addresses[i], balance: outcome.value.balance, nonce: outcome.value.nonce})
    } else {
      missing.push(addresses[i])
    }
  })
  return {infos, missing}
}