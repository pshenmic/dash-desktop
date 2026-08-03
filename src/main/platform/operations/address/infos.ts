import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'

type Payload = PlatformOperations['addressInfos']['payload']
type Result = PlatformOperations['addressInfos']['result']

// One proof-verified batch, no per-address fallback: the proof either covers
// the whole query or the call throws, so an address absent from the answer is
// absent from state — never an address we failed to ask about (finding R-4).
export async function addressInfos(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {addresses} = payload
  if (addresses.length === 0) return {infos: []}

  const {sdk, network} = ctx
  const batch = await sdk.platformAddresses.getAddressesInfos(addresses)

  return {
    infos: batch
      .filter(info => info.address != null)
      .map(info => ({
        address: info.address.toBech32m(network),
        balance: info.balance,
        nonce: info.nonce,
      })),
  }
}