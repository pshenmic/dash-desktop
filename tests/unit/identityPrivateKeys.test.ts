import {describe, it, expect} from 'vitest'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {identityPrivateKeys} from '../../src/main/platform/operations/identity/privateKeys'
import {OperationContext} from '../../src/main/platform/operations/types'

const keyPair = new KeyPairController()
const SEED = keyPair.mnemonicToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
const hdKey = keyPair.seedToHdKey(SEED, 'testnet')
const hashAt = (keyId: number) =>
  PrivateKeyWASM.fromBytes(keyPair.deriveIdentityPrivateKey(hdKey, 0, keyId, 'testnet').privateKey as Uint8Array, 'testnet').getPublicKeyHash()

describe('identityPrivateKeys', () => {
  it('reveals the keys this wallet derives at their key id, and leaves out one another wallet added', async () => {
    const keys = [{keyId: 0, hash: hashAt(0)}, {keyId: 2, hash: hashAt(2)}, {keyId: 3, hash: hashAt(7)}]
    const ctx = {
      sdk: {keyPair, identities: {getIdentityPublicKeys: async () => keys.map(({keyId, hash}) => ({keyId, getPublicKeyHash: () => hash}))}},
      network: 'testnet',
    } as unknown as OperationContext

    const result = await identityPrivateKeys({seed: SEED, identifier: 'id', identityIndex: 0}, ctx)

    expect(result.keys.map(key => key.keyId)).toEqual([0, 2])
    for (const key of result.keys) {
      expect(PrivateKeyWASM.fromWIF(key.wif).getPublicKeyHash()).toBe(hashAt(key.keyId))
      expect(PrivateKeyWASM.fromHex(key.hex, 'testnet').getPublicKeyHash()).toBe(hashAt(key.keyId))
    }
  })
})
