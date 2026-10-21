import {hexToBytes} from '@noble/hashes/utils.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {dashPaySharedKey, decryptDashPayContactKey} from '../../../src/utils/dashPayKeys'
import {signingKey} from '../identity/signingKey'

type Payload = PlatformOperations['dashPayContactKey']['payload']
type Result = PlatformOperations['dashPayContactKey']['result']

// The key a contact sent us, which we derive our payments to them from.
export async function dashPayContactKey(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, request} = payload

  const [senderKeys, decryption] = await Promise.all([
    sdk.identities.getIdentityPublicKeys(request.ownerId),
    signingKey(sdk, seed, network, identifier, identityIndex, 'DECRYPTION'),
  ])
  const encryption = senderKeys.find(key => key.keyId === request.senderKeyIndex)
  if (encryption == null || decryption.publicKey.keyId !== request.recipientKeyIndex) {
    throw new OperationError('This contact request is encrypted to a key this wallet does not hold', 'internal')
  }

  const shared = dashPaySharedKey(decryption.privateKey.bytes(), hexToBytes(encryption.data))
  return {xpub: decryptDashPayContactKey(shared, request.encryptedPublicKey).publicExtendedKey}
}
