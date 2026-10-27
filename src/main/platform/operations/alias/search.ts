import {DPNS_DATA_CONTRACT_ID} from 'dash-platform-sdk/src/constants.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {DPNS_PARENT_DOMAIN, PROVED_QUERY_LIMIT} from '../../constants'

type Payload = PlatformOperations['aliasSearch']['payload']
type Result = PlatformOperations['aliasSearch']['result']

// The SDK's searchByName refuses a prefix shorter than a name, so its query runs here.
// Owners, not records.identity: a transferred name keeps its old record.
export async function aliasSearch(payload: Payload, {sdk}: OperationContext): Promise<Result> {
  const domains = await sdk.documents.query(DPNS_DATA_CONTRACT_ID, 'domain', [
    ['normalizedParentDomainName', '==', DPNS_PARENT_DOMAIN],
    ['normalizedLabel', 'startsWith', sdk.names.normalizeLabel(payload.prefix)],
  ], [['normalizedLabel', 'asc']], PROVED_QUERY_LIMIT)
  return {
    results: domains.map(domain => ({
      identifier: domain.ownerId.base58(),
      name: `${domain.properties.label}.${domain.properties.parentDomainName}`,
    })),
  }
}
