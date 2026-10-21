import {hexToBytes} from '@noble/hashes/utils.js'
import {HDKey} from '@scure/bip32'
import {IdentifierWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {dashPayContactRequestFee} from '../fee'
import {DASHPAY_RECIPIENT_KEY_PURPOSES} from '../../constants'
import {DASHPAY_CONTRACT_ID} from '../../../src/constants/credits'
import {accountReference, dashPayAccountPath, dashPaySharedKey, deriveDashPayContactKey, encryptDashPayContactKey} from '../../../src/utils/dashPayKeys'
import {applySignature, signingKey} from '../identity/signingKey'
import {Logger} from '../../../src/utils/logger'

const log = new Logger('platform')

type Payload = PlatformOperations['dashPayContactRequestSend']['payload']
type Result = PlatformOperations['dashPayContactRequestSend']['result']

// Requests are immutable and undeletable, so every refusal is made before one is written.
export async function dashPayContactRequestSend(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, recipient} = payload

  const [ourKeys, recipientKeys, [earlier]] = await Promise.all([
    sdk.identities.getIdentityPublicKeys(identifier),
    sdk.identities.getIdentityPublicKeys(recipient),
    sdk.documents.query(DASHPAY_CONTRACT_ID, 'contactRequest', [['$ownerId', '==', identifier], ['toUserId', '==', recipient]], undefined, 1),
  ])
  if (earlier != null) throw new OperationError('A contact request to this identity was already sent', 'internal')
  if (!ourKeys.some(key => key.purpose === 'ENCRYPTION' && key.keyType === 'ECDSA_SECP256K1' && key.disabledAt == null)) {
    throw new OperationError('Create DashPay keys for this identity before sending a contact request', 'internal')
  }
  const recipientKey = DASHPAY_RECIPIENT_KEY_PURPOSES
    .map(purpose => recipientKeys.find(key => key.purpose === purpose && key.keyType === 'ECDSA_SECP256K1' && key.disabledAt == null))
    .find(key => key != null)
  if (recipientKey == null) {
    throw new OperationError('This identity cannot receive contact requests until its wallet adds an encryption key to it', 'internal')
  }
  const [cost, balance] = await Promise.all([dashPayContactRequestFee(ctx, recipient, identifier), sdk.identities.getIdentityBalance(identifier)])
  log.info(`contact request ${identifier} -> ${recipient}: costs ${cost.feeCredits} of ${balance} credits`)
  if (balance < cost.feeCredits) throw new OperationError('The identity cannot afford a contact request', 'insufficientFunds')

  const encryption = await signingKey(sdk, seed, network, identifier, identityIndex, 'ENCRYPTION')
  const account = HDKey.fromMasterSeed(seed).derive(dashPayAccountPath(network))
  const contactKey = deriveDashPayContactKey(account, new IdentifierWASM(identifier).bytes(), new IdentifierWASM(recipient).bytes())
  const encryptedPublicKey = encryptDashPayContactKey(dashPaySharedKey(encryption.privateKey.bytes(), hexToBytes(recipientKey.data)), contactKey)

  const auth = await signingKey(sdk, seed, network, identifier, identityIndex, 'AUTHENTICATION', 'HIGH')
  const nonce = await sdk.identities.getIdentityContractNonce(identifier, DASHPAY_CONTRACT_ID) + 1n
  const document = sdk.documents.create(DASHPAY_CONTRACT_ID, 'contactRequest', {
    toUserId: new IdentifierWASM(recipient).bytes(),
    encryptedPublicKey,
    senderKeyIndex: encryption.publicKey.keyId,
    recipientKeyIndex: recipientKey.keyId,
    accountReference: accountReference(encryption.privateKey.bytes(), contactKey),
  }, identifier, nonce)
  ctx.progress('signing', 0, 0)
  const st = sdk.documents.createStateTransition(document, 'create', {identityContractNonce: nonce})
  applySignature(st, auth.privateKey, auth.publicKey)

  return {stHash: await broadcast(sdk, st, ctx)}
}
