import {hexToBytes} from '@noble/hashes/utils.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {dashPaySharedKey, decryptDashPayContactKey} from '../../../src/utils/dashPayKeys'
import {signingKey} from '../identity/signingKey'
import {Logger} from '../../../src/utils/logger'

const log = new Logger('platform')

type Payload = PlatformOperations['dashPayContactKey']['payload']
type Result = PlatformOperations['dashPayContactKey']['result']

// The key a contact sent us, which we derive our payments to them from. A
// request is immutable, so a fault in it answers null instead of throwing:
// only a new request from the contact can mend it.
export async function dashPayContactKey(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, request} = payload
  const broken = (reason: string): Result => {
    log.warn(`contact request ${request.ownerId} -> ${identifier}: payment channel broken, ${reason}`)
    return {xpub: null}
  }

  const [senderKeys, ourKeys] = await Promise.all([
    sdk.identities.getIdentityPublicKeys(request.ownerId),
    sdk.identities.getIdentityPublicKeys(identifier),
  ])
  const encryption = senderKeys.find(key => key.keyId === request.senderKeyIndex)
  const recipient = ourKeys.find(key => key.keyId === request.recipientKeyIndex)
  // Identities gain keys and purposes may still be accepted later, so neither is final.
  if (encryption == null || recipient == null || encryption.purpose !== 'ENCRYPTION' || recipient.purpose !== 'DECRYPTION') {
    throw new OperationError('The keys this contact request names are not usable yet', 'internal')
  }
  if (encryption.keyType !== 'ECDSA_SECP256K1' || recipient.keyType !== 'ECDSA_SECP256K1') return broken('a key cannot do ECDH')
  if (recipient.disabledAt != null) return broken('our key it is encrypted to is disabled')

  let decryption: Awaited<ReturnType<typeof signingKey>>
  try {
    decryption = await signingKey(sdk, seed, network, identifier, identityIndex, 'DECRYPTION')
  } catch (err) {
    if (err instanceof OperationError) return broken('this wallet derives no DECRYPTION key of ours')
    throw err
  }
  if (decryption.publicKey.keyId !== recipient.keyId) return broken('it is encrypted to a key this wallet does not derive')

  try {
    const shared = dashPaySharedKey(decryption.privateKey.bytes(), hexToBytes(encryption.data))
    return {xpub: decryptDashPayContactKey(shared, request.encryptedPublicKey).publicExtendedKey}
  } catch {
    return broken('its encrypted key does not decrypt')
  }
}
