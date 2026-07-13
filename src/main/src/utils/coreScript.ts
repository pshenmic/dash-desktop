import {CoreScriptWASM} from 'pshenmic-dpp'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {Network} from '../types'
import {ADDRESS_PREFIX} from '../constants'

const ADDRESS_DECODED_LENGTH = 21

export function coreAddressToScript(coreAddress: string, network: Network): CoreScriptWASM {
  let decoded: Uint8Array
  try {
    decoded = Base58Check.decode(coreAddress)
  } catch {
    throw new Error(`Invalid Core address: ${coreAddress}`)
  }
  if (decoded.length !== ADDRESS_DECODED_LENGTH) {
    throw new Error(`Invalid Core address: ${coreAddress}`)
  }
  const prefixes = ADDRESS_PREFIX[network]
  const hash = decoded.slice(1)
  if (decoded[0] === prefixes.p2pkh) {
    return CoreScriptWASM.newP2PKH(hash)
  }
  if (decoded[0] === prefixes.p2sh) {
    return CoreScriptWASM.newP2SH(hash)
  }
  throw new Error(`Core address is not a valid ${network} address`)
}
