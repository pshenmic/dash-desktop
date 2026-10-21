import {describe, it, expect} from 'vitest'
import {dashPayContactKey} from '../../src/main/platform/operations/dashpay/key'
import {OperationContext} from '../../src/main/platform/operations/types'

const OURS = 'ours'
const THEIRS = 'theirs'
const request = {
  id: 'r', ownerId: THEIRS, toUserId: OURS, senderKeyIndex: 3, recipientKeyIndex: 4, accountReference: 0,
  encryptedPublicKey: new Uint8Array(96), createdAt: 0, contactXpub: null, paymentChannelBroken: false,
}

function run(keys: Record<string, Array<{keyId: number; purpose: string; keyType: string}>>) {
  const ctx = {
    sdk: {identities: {getIdentityPublicKeys: async (identifier: string) => keys[identifier]}},
    network: 'testnet',
  } as unknown as OperationContext
  return dashPayContactKey({seed: new Uint8Array(64), identifier: OURS, identityIndex: 0, request}, ctx)
}

// Only a fault no later state can mend may break the channel for good.
describe('dashPayContactKey', () => {
  it('answers null for a key that can never do ECDH', async () => {
    expect(await run({
      [THEIRS]: [{keyId: 3, purpose: 'ENCRYPTION', keyType: 'BLS12_381'}],
      [OURS]: [{keyId: 4, purpose: 'DECRYPTION', keyType: 'ECDSA_SECP256K1'}],
    })).toEqual({xpub: null})
  })

  it('throws, so it is retried, while a named key is not on Platform yet', async () => {
    await expect(run({
      [THEIRS]: [],
      [OURS]: [{keyId: 4, purpose: 'DECRYPTION', keyType: 'ECDSA_SECP256K1'}],
    })).rejects.toThrow('not usable yet')
  })
})
