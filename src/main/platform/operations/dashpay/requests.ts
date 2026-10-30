import {DocumentWASM, IdentifierWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {PROVED_QUERY_LIMIT} from '../../constants'
import {DASHPAY_CONTRACT_ID} from '../../../src/constants/credits'
import {DashPayContactRequest} from '../../../src/types/DashPay'

type Payload = PlatformOperations['dashPayContactRequests']['payload']
type Result = PlatformOperations['dashPayContactRequests']['result']

export async function dashPayContactRequests({identifier, since}: Payload, {sdk}: OperationContext): Promise<Result> {
  // `>=` keeps a request sharing the boundary millisecond; the caller drops what it already has.
  const all = async (field: string): Promise<DashPayContactRequest[]> => {
    const requests = new Map<string, DashPayContactRequest>()
    let page: DashPayContactRequest[] = []
    do {
      const from = page.at(-1)?.createdAt ?? since
      page = (await sdk.documents.query(DASHPAY_CONTRACT_ID, 'contactRequest',
        [[field, '==', identifier], ['$createdAt', '>=', from]], [['$createdAt', 'asc']], PROVED_QUERY_LIMIT)).map(dashPayContactRequest)
      for (const request of page) if (!requests.has(request.id)) requests.set(request.id, request)
    } while (page.length === PROVED_QUERY_LIMIT)
    return [...requests.values()]
  }
  const [sent, received] = await Promise.all([all('$ownerId'), all('toUserId')])
  return {sent, received}
}

function dashPayContactRequest(document: DocumentWASM): DashPayContactRequest {
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
    coreHeightCreatedAt: document.createdAtCoreBlockHeight ?? 0,
  }
}
