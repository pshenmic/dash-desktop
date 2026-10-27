import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'

type Payload = PlatformOperations['identityPrivateKeys']['payload']
type Result = PlatformOperations['identityPrivateKeys']['result']

// Every key this wallet registers is derived at its own key id; one whose hash
// does not match was added by another wallet, and is left out.
export async function identityPrivateKeys({seed, identifier, identityIndex}: Payload, {sdk, network}: OperationContext): Promise<Result> {
  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const keys = await sdk.identities.getIdentityPublicKeys(identifier)

  return {
    keys: keys.flatMap(key => {
      const child = sdk.keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, key.keyId, network)
      if (child.privateKey == null) return []

      const privateKey = PrivateKeyWASM.fromBytes(child.privateKey, network)
      if (privateKey.getPublicKeyHash() !== key.getPublicKeyHash()) return []

      return [{keyId: key.keyId, wif: privateKey.WIF(), hex: privateKey.hex()}]
    }),
  }
}
