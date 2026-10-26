import {describe, it, expect} from 'vitest'
import {bytesToHex} from '@noble/hashes/utils.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {IdentityPublicKeyWASM, IdentityUpdateTransitionWASM, PurposeLike, SecurityLevelLike, StateTransitionWASM} from 'pshenmic-dpp'
import {identityDisableKeys} from '../../src/main/platform/operations/identity/disableKeys'
import {OperationContext} from '../../src/main/platform/operations/types'

const IDENTIFIER = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'
const keyPair = new KeyPairController()
const SEED = keyPair.mnemonicToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
const hdKey = keyPair.seedToHdKey(SEED, 'testnet')

// Real keys at their own derivation index, so the MASTER signature is a real one.
function key(keyId: number, purpose: PurposeLike, securityLevel: SecurityLevelLike, disabledAt?: number): IdentityPublicKeyWASM {
  const {publicKey} = keyPair.deriveIdentityPrivateKey(hdKey, 0, keyId, 'testnet')
  return new IdentityPublicKeyWASM(keyId, purpose, securityLevel, 'ECDSA_SECP256K1', false, bytesToHex(publicKey as Uint8Array), disabledAt)
}

function run(keyIds: number[]) {
  const keys = [key(0, 'AUTHENTICATION', 'MASTER'), key(1, 'AUTHENTICATION', 'HIGH'), key(3, 'ENCRYPTION', 'MEDIUM', 1)]
  const broadcasts: StateTransitionWASM[] = []
  const ctx = {
    sdk: {
      keyPair,
      identities: {
        getIdentityByIdentifier: async () => ({revision: 2n, getPublicKeys: () => keys}),
        getIdentityPublicKeys: async () => keys,
        getIdentityNonce: async () => 5n,
      },
      stateTransitions: {broadcast: async (st: StateTransitionWASM) => { broadcasts.push(st) }, waitForStateTransitionResult: async () => undefined},
    },
    network: 'testnet',
    progress: () => undefined,
  } as unknown as OperationContext
  return {broadcasts, result: identityDisableKeys({seed: SEED, identifier: IDENTIFIER, identityIndex: 0, keyIds}, ctx)}
}

describe('identityDisableKeys', () => {
  it('disables the keys in one identity update signed by the MASTER key', async () => {
    const {broadcasts, result} = run([1])
    await result

    const transition = IdentityUpdateTransitionWASM.fromStateTransition(broadcasts[0])
    expect(transition.publicKeyIdsToDisable).toEqual([1])
    expect(transition.revision).toBe(3n)
    expect(transition.signaturePublicKeyId).toBe(0)
  })

  it('broadcasts nothing for a key it cannot find, one already disabled, or the MASTER key', async () => {
    for (const [keyId, message] of [[9, 'no key 9'], [3, 'already disabled'], [0, 'MASTER']] as const) {
      const {broadcasts, result} = run([1, keyId])
      await expect(result).rejects.toThrow(message)
      expect(broadcasts).toHaveLength(0)
    }
  })
})
