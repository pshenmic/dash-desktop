import {DashPlatformSDK} from 'dash-platform-sdk'
import {IdentityPublicKeyWASM, PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {StateTransitionWASM} from 'pshenmic-dpp'
import {Network} from '../../../src/types'
import {DerivedKeyHash, matchIdentityKey} from '../../../src/utils/identityKeys'
import {OperationError} from '../types'

const IDENTITY_KEY_LOOKAHEAD = 20

// Needs both the derived private keys and the live key list from the chain, so
// it cannot be split across the process boundary — main sends the identifier
// and the derivation index, nothing more.
export async function signingKey(
  sdk: DashPlatformSDK,
  seed: Uint8Array,
  network: Network,
  identifier: string,
  identityIndex: number,
): Promise<{privateKey: PrivateKeyWASM; publicKey: IdentityPublicKeyWASM}> {
  const identityKeys = await sdk.identities.getIdentityPublicKeys(identifier)
  const hdKey = sdk.keyPair.seedToHdKey(seed, network)

  const derived: Array<{keyIndex: number; privateKey: PrivateKeyWASM}> = []
  const hashes: DerivedKeyHash[] = []
  for (let keyIndex = 0; keyIndex < IDENTITY_KEY_LOOKAHEAD; keyIndex++) {
    const child = sdk.keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, keyIndex, network)
    if (!child.privateKey) continue
    const privateKey = PrivateKeyWASM.fromBytes(child.privateKey as Uint8Array, network)
    derived.push({keyIndex, privateKey})
    hashes.push({keyIndex, publicKeyHashHex: privateKey.getPublicKeyHash()})
  }

  const match = matchIdentityKey(
    identityKeys.map(key => ({keyId: key.keyId, purpose: key.purpose, publicKeyHashHex: key.getPublicKeyHash()})),
    hashes,
  )
  const privateKey = match != null ? derived.find(entry => entry.keyIndex === match.keyIndex)?.privateKey : undefined
  const publicKey = match != null ? identityKeys.find(key => key.keyId === match.keyId) : undefined
  if (privateKey == null || publicKey == null) {
    throw new OperationError('This identity has no transfer key this wallet can sign with', 'internal')
  }

  return {privateKey, publicKey}
}

// The SDK only fills the signature when the transition does not already carry
// one, so the caller assigns it explicitly.
export function applySignature(
  st: StateTransitionWASM,
  privateKey: PrivateKeyWASM,
  publicKey: IdentityPublicKeyWASM,
): void {
  const signature = st.sign(privateKey, publicKey)
  if (st.signature == null || st.signature.length === 0) {
    st.signature = signature
    st.signaturePublicKeyId = publicKey.keyId
  }
}
