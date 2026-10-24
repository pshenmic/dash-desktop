import {describe, it, expect} from 'vitest'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {DashPlatformSDK} from 'dash-platform-sdk'
import {signingKey} from '../../src/main/platform/operations/identity/signingKey'

const keyPair = new KeyPairController()
const SEED = keyPair.mnemonicToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
const hdKey = keyPair.seedToHdKey(SEED, 'testnet')

// Keys at their own derivation index, as this wallet registers them.
function sdkWith(keys: Array<{keyId: number; disabled?: boolean}>): DashPlatformSDK {
  const publicKeys = keys.map(({keyId, disabled}) => {
    const {privateKey} = keyPair.deriveIdentityPrivateKey(hdKey, 0, keyId, 'testnet')
    const hash = PrivateKeyWASM.fromBytes(privateKey as Uint8Array, 'testnet').getPublicKeyHash()
    return {keyId, purpose: 'DECRYPTION', securityLevel: 'MEDIUM', disabledAt: disabled ? 1 : undefined, getPublicKeyHash: () => hash}
  })
  return {keyPair, identities: {getIdentityPublicKeys: async () => publicKeys}} as unknown as DashPlatformSDK
}

describe('signingKey', () => {
  it('signs with the key asked for, not the lowest of its purpose and level', async () => {
    const {publicKey} = await signingKey(sdkWith([{keyId: 4}, {keyId: 6}]), SEED, 'testnet', 'id', 0, 'DECRYPTION', 'MEDIUM', 6)
    expect(publicKey.keyId).toBe(6)
  })

  it('skips a disabled key', async () => {
    const {publicKey} = await signingKey(sdkWith([{keyId: 4, disabled: true}, {keyId: 6}]), SEED, 'testnet', 'id', 0, 'DECRYPTION')
    expect(publicKey.keyId).toBe(6)
  })
})
