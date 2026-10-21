import {DocumentWASM, IdentifierWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {DASHPAY_CONTRACT_ID, PROVED_QUERY_LIMIT} from '../../constants'
import {ContactRequest} from '../../../src/types/Contact'

type Payload = PlatformOperations['contactRequests']['payload']
type Result = PlatformOperations['contactRequests']['result']

export async function contactRequests({identifier, since}: Payload, {sdk}: OperationContext): Promise<Result> {
  const page = async (field: string) => (await sdk.documents.query(DASHPAY_CONTRACT_ID, 'contactRequest',
    [[field, '==', identifier], ['$createdAt', '>', since]], [['$createdAt', 'asc']], PROVED_QUERY_LIMIT)).map(contactRequest)
  const [sent, received] = await Promise.all([page('$ownerId'), page('toUserId')])
  return {sent, received}
}

function contactRequest(document: DocumentWASM): ContactRequest {
  const {toUserId, senderKeyIndex, recipientKeyIndex, accountReference, encryptedPublicKey} = document.properties
  return {
    id: document.id.base58(),
    ownerId: document.ownerId.base58(),
    toUserId: new IdentifierWASM(toUserId).base58(),
    senderKeyIndex,
    recipientKeyIndex,
    accountReference,
    encryptedPublicKey: Uint8Array.from(encryptedPublicKey),
    createdAt: Number(document.createdAt),
  }
}
