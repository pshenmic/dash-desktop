import {base64} from '@scure/base'
import {DPNS_DATA_CONTRACT_ID} from 'dash-platform-sdk/src/constants.js'
import indexBytesToString from 'dash-platform-sdk/src/utils/indexBytesToString.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {contest} from './status'
import {DPNS_CONTESTED_INDEX, PROVED_QUERY_LIMIT} from '../../constants'

type Payload = PlatformOperations['usernameContests']['payload']
type Result = PlatformOperations['usernameContests']['result']

export async function usernameContests({identifiers}: Payload, ctx: OperationContext): Promise<Result> {
  const labels = new Set<string>()
  let start = BigInt(Date.now())
  for (;;) {
    const groups = await ctx.sdk.contestedResources.getVotePollsByEndDate({timeMs: start, included: true}, undefined, PROVED_QUERY_LIMIT)
    const polls = groups.flatMap(group => group.votePolls)
    const domains = polls.filter(poll => poll.contractId.base58() === DPNS_DATA_CONTRACT_ID && poll.documentTypeName === 'domain' && poll.indexName === DPNS_CONTESTED_INDEX)
    // An index value comes as base64 of its serialized platform value.
    domains.forEach(poll => labels.add(indexBytesToString(base64.decode(poll.indexValues[1]))))

    // Polls sharing an end time can straddle a page, so the next page starts at it.
    const last = groups.at(-1)?.timestampMs
    if (polls.length < PROVED_QUERY_LIMIT || last == null || last === start) break
    start = last
  }

  const contests = await Promise.all([...labels].map(async (label) => {
    const vote = await contest(ctx, label)
    return (vote?.contenders ?? [])
      .filter(contender => identifiers.includes(contender.identifier))
      .map(({identifier}) => ({identifier, label}))
  }))

  return {contests: contests.flat()}
}
