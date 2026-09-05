import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {PROVED_QUERY_LIMIT} from '../../constants'

type Payload = PlatformOperations['addressInfos']['payload']
type Result = PlatformOperations['addressInfos']['result']

// Proof-verified batches, no per-address fallback: each page's proof either
// covers that page or the call throws, so an address absent from the answer is
// absent from state — never an address we failed to ask about (finding R-4).
// Drive rejects a page over the cap rather than truncating it, so a wallet past
// one page can only be asked a page at a time.
export async function addressInfos(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {addresses} = payload
  if (addresses.length === 0) return {infos: []}

  const {sdk, network} = ctx
  const infos: Result['infos'] = []
  for (let start = 0; start < addresses.length; start += PROVED_QUERY_LIMIT) {
    const batch = await sdk.platformAddresses.getAddressesInfos(addresses.slice(start, start + PROVED_QUERY_LIMIT))
    infos.push(...batch
      .filter(info => info.address != null)
      .map(info => ({
        address: info.address.toBech32m(network),
        balance: info.balance,
        nonce: info.nonce,
      })))
  }

  return {infos}
}