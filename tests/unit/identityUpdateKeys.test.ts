import {describe, it, expect} from 'vitest'
import {bytesToHex} from '@noble/hashes/utils.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {IdentityPublicKeyWASM, IdentityUpdateTransitionWASM, PurposeLike, SecurityLevelLike, StateTransitionWASM} from 'pshenmic-dpp'
import {identityUpdateKeys} from '../../src/main/platform/operations/identity/updateKeys'
import {IdentityKeysUpdate} from '../../src/main/src/types/IdentityKeys'
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

function run(update: IdentityKeysUpdate) {
  const keys = [key(0, 'AUTHENTICATION', 'MASTER'), key(1, 'AUTHENTICATION', 'HIGH'), key(3, 'ENCRYPTION', 'MEDIUM', 1)]
  const broadcasts: StateTransitionWASM[] = []
  const ctx = {
    sdk: {
      keyPair,
      identities: {
        getIdentityByIdentifier: async () => ({balance: 100_000_000n, revision: 2n, getPublicKeys: () => keys}),
        getIdentityPublicKeys: async () => keys,
        getIdentityNonce: async () => 5n,
      },
      stateTransitions: {broadcast: async (st: StateTransitionWASM) => { broadcasts.push(st) }, waitForStateTransitionResult: async () => undefined},
    },
    network: 'testnet',
    progress: () => undefined,
  } as unknown as OperationContext
  return {broadcasts, result: identityUpdateKeys({seed: SEED, identifier: IDENTIFIER, identityIndex: 0, ...update}, ctx)}
}

const MASTER = {purpose: 'AUTHENTICATION', securityLevel: 'MASTER', contractBounds: null} as const

describe('identityUpdateKeys', () => {
  it('disables keys in one identity update signed by the MASTER key', async () => {
    const {broadcasts, result} = run({add: [], disable: [1]})
    await result

    const transition = IdentityUpdateTransitionWASM.fromStateTransition(broadcasts[0])
    expect(transition.publicKeyIdsToDisable).toEqual([1])
    expect(transition.publicKeyIdsToAdd).toEqual([])
    expect(transition.revision).toBe(3n)
    expect(transition.signaturePublicKeyId).toBe(0)
  })

  // The current MASTER key signs the update that replaces it.
  it('replaces the MASTER key with a new one at the next key id, proved by its own signature', async () => {
    const {broadcasts, result} = run({add: [MASTER], disable: [0]})
    await result

    const transition = IdentityUpdateTransitionWASM.fromStateTransition(broadcasts[0])
    const [added] = transition.publicKeyIdsToAdd
    expect([added.keyId, added.securityLevel, added.signature.length > 0]).toEqual([4, 'MASTER', true])
    expect(transition.publicKeyIdsToDisable).toEqual([0])
    expect(transition.signaturePublicKeyId).toBe(0)
  })

  // Drive charges a nonce bump for each of these, or accepts the last for nothing.
  it('broadcasts nothing for an unknown key, a MASTER key added or disabled alone, or a key already disabled', async () => {
    const refused: Array<[IdentityKeysUpdate, string]> = [
      [{add: [], disable: [9]}, 'no key 9'],
      [{add: [], disable: [0]}, 'MASTER'],
      [{add: [MASTER], disable: []}, 'MASTER'],
      [{add: [MASTER, MASTER], disable: [0]}, 'MASTER'],
      [{add: [], disable: [3]}, 'already disabled'],
    ]
    for (const [update, message] of refused) {
      const {broadcasts, result} = run(update)
      await expect(result).rejects.toThrow(message)
      expect(broadcasts).toHaveLength(0)
    }
  })
})
