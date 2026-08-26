import {HDKey} from '@scure/bip32'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {Network} from '../types/Network'

import {AddressDeriver} from '../types/AddressWindow'
import {COIN_TYPE, HD_VERSIONS} from '../constants'

const keyPair = new KeyPairController()

export function coreAccountPath(coinType: number, accountId: number): string {
  return `m/44'/${coinType}'/${accountId}'`
}

export function deriveCorePublicKey(coreXpub: string, network: Network, isChange: boolean, index: number): Uint8Array {
  const accountNode = HDKey.fromExtendedKey(coreXpub, HD_VERSIONS[network])
  const child = accountNode.deriveChild(isChange ? 1 : 0).deriveChild(index)
  if (child.publicKey == null) {
    throw new Error(`Could not derive core public key at index ${index}`)
  }
  return child.publicKey
}

// One BIP-44 chain of the account xpub. Account 0 is the only account this
// wallet has, so the path is fixed once the chain is chosen.
export function coreAddressDeriver(coreXpub: string, network: Network, isChange: boolean): AddressDeriver {
  const chainPath = `${coreAccountPath(COIN_TYPE[network], 0)}/${isChange ? 1 : 0}`
  return {
    derive: index => ({
      index,
      address: keyPair.p2pkhAddress(deriveCorePublicKey(coreXpub, network, isChange, index), network),
      derivationPath: `${chainPath}/${index}`,
    }),
  }
}
