import {hexToBytes} from '@noble/hashes/utils.js'
import {IdentifierWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {dashPayContactRequestFee} from '../fee'
import {DASHPAY_CONTRACT_ID} from '../../constants'
import {accountReference, dashPaySharedKey, deriveDashPayContactKey, encryptDashPayContactKey} from '../../../src/utils/dashPayKeys'
import {identityAddEncryptionKeys} from '../identity/addEncryptionKeys'
import {applySignature, signingKey} from '../identity/signingKey'
import {Logger} from '../../../src/utils/logger'

const log = new Logger('platform')

type Payload = PlatformOperations['dashPayContactRequestSend']['payload']
type Result = PlatformOperations['dashPayContactRequestSend']['result']

// Requests are immutable and undeletable, so every refusal is made before one is written.
export async function dashPayContactRequestSend(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, recipient} = payload

  const [recipientKeys, [earlier]] = await Promise.all([
    sdk.identities.getIdentityPublicKeys(recipient),
    sdk.documents.query(DASHPAY_CONTRACT_ID, 'contactRequest', [['$ownerId', '==', identifier], ['toUserId', '==', recipient]], undefined, 1),
  ])
  if (earlier != null) throw new OperationError('A contact request to this identity was already sent', 'internal')
  const decryption = recipientKeys
    .filter(key => key.purpose === 'DECRYPTION' && key.keyType === 'ECDSA_SECP256K1' && key.disabledAt == null)
    .at(-1)
  if (decryption == null) throw new OperationError('This identity has no key to receive contact requests with', 'internal')
  const [cost, balance] = await Promise.all([dashPayContactRequestFee(ctx, recipient, identifier), sdk.identities.getIdentityBalance(identifier)])
  log.info(`contact request ${identifier} -> ${recipient}: costs ${cost.feeCredits} of ${balance} credits`)
  if (balance < cost.feeCredits) throw new OperationError('The identity cannot afford a contact request', 'insufficientFunds')

  await identityAddEncryptionKeys({seed, identifier, identityIndex}, ctx)
  const encryption = await signingKey(sdk, seed, network, identifier, identityIndex, 'ENCRYPTION')
  const contactKey = deriveDashPayContactKey(seed, network, new IdentifierWASM(identifier).bytes(), new IdentifierWASM(recipient).bytes())
  const encryptedPublicKey = encryptDashPayContactKey(dashPaySharedKey(encryption.privateKey.bytes(), hexToBytes(decryption.data)), contactKey)

  const auth = await signingKey(sdk, seed, network, identifier, identityIndex, 'AUTHENTICATION', 'HIGH')
  const nonce = await sdk.identities.getIdentityContractNonce(identifier, DASHPAY_CONTRACT_ID) + 1n
  const document = sdk.documents.create(DASHPAY_CONTRACT_ID, 'contactRequest', {
    toUserId: new IdentifierWASM(recipient).bytes(),
    encryptedPublicKey,
    senderKeyIndex: encryption.publicKey.keyId,
    recipientKeyIndex: decryption.keyId,
    accountReference: accountReference(contactKey),
  }, identifier, nonce)
  ctx.progress('signing', 0, 0)
  const st = sdk.documents.createStateTransition(document, 'create', {identityContractNonce: nonce})
  applySignature(st, auth.privateKey, auth.publicKey)

  return {stHash: await broadcast(sdk, st, ctx)}
}
