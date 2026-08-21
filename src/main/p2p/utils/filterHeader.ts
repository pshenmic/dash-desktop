import {utils as sdkUtils} from 'dash-core-sdk'
import {HASH_LEN} from '../constants'

const {doubleSHA256} = sdkUtils

// BIP 157 links each filter to the one below it:
//   header(h) = dSHA256( dSHA256(filter(h)) || header(h-1) )
// The cfheaders walk derives the chain from peer-supplied filter hashes and
// anchors it on cfcheckpt; the scan runs the same derivation over the filter
// payload itself, which is what proves the payload is the one the anchors
// committed to.
export function deriveFilterHeader(filterHash: Uint8Array, prevHeader: Uint8Array): Uint8Array {
  const concat = new Uint8Array(HASH_LEN * 2)
  concat.set(filterHash, 0)
  concat.set(prevHeader, HASH_LEN)
  return doubleSHA256(concat)
}

export function hashFilter(filter: Uint8Array): Uint8Array {
  return doubleSHA256(filter)
}
