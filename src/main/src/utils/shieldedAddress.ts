import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {Network} from '../types/Network'
import {AddressDeriver} from '../types/AddressWindow'
import {COIN_TYPE, SHIELDED_ACCOUNT} from '../constants/addresses'

const keyPair = new KeyPairController()

// ZIP-32 diversified addresses of one Orchard account. Unlike DIP-17 and BIP-44
// there is no watch-only key to derive from, so this needs the seed and can only
// run inside an unlocked operation.
//
// The diversifier is not a path element, so `derivationPath` names the account
// and is the same for every index. It satisfies AddressDeriver and is not
// persisted — a column would repeat one string on every row.
export function shieldedAddressDeriver(seed: Uint8Array, network: Network): AddressDeriver {
  const accountPath = `m/32'/${COIN_TYPE[network]}'/${SHIELDED_ACCOUNT}'`
  return {
    derive: index => ({
      index,
      address: keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT, index).toBech32m(network),
      derivationPath: accountPath,
    }),
  }
}
