import {DashPlatformSDK} from 'dash-platform-sdk'
import {IdentityPublicKeyInCreation} from 'dash-platform-sdk/types.js'
import {PrivateKeyWASM} from 'pshenmic-dpp'
import {Network} from '../../../../src/types'
import {IDENTITY_KEY_DEFINITIONS} from '../../../../src/utils/identityKeys'

// createStateTransition destructures plain {id, purpose, ...} objects and
// builds the WASM keys itself — passing IdentityPublicKeyInCreationWASM here
// breaks (its field is keyId).
export function identityKeys(
  sdk: DashPlatformSDK,
  seed: Uint8Array,
  network: Network,
  identityIndex: number,
): {publicKeys: IdentityPublicKeyInCreation[]; privateKeys: PrivateKeyWASM[]} {
  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const privateKeys = IDENTITY_KEY_DEFINITIONS.map(({id}) => {
    const derived = sdk.keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, id, network)
    if (derived.privateKey == null) {
      throw new Error(`Could not derive identity key ${id}`)
    }
    return PrivateKeyWASM.fromBytes(derived.privateKey, network)
  })
  const publicKeys = IDENTITY_KEY_DEFINITIONS.map(({id, purpose, securityLevel, keyType}, i) => ({
    id,
    purpose,
    securityLevel,
    keyType,
    readOnly: false,
    data: Uint8Array.from(privateKeys[i].getPublicKey().bytes()),
  }))
  return {publicKeys, privateKeys}
}