import {base64} from '@scure/base'
import {DPNS_DATA_CONTRACT_ID} from 'dash-platform-sdk/src/constants.js'
import indexBytesToString from 'dash-platform-sdk/src/utils/indexBytesToString.js'
import {VotePollsByEndDateTimeBound} from 'pshenmic-dpp'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {contest} from './status'
import {DPNS_CONTESTED_INDEX, PROVED_QUERY_LIMIT} from '../../constants'

type Payload = PlatformOperations['usernameContests']['payload']
type Result = PlatformOperations['usernameContests']['result']

export async function usernameContests({identifiers}: Payload, ctx: OperationContext): Promise<Result> {
  const labels = new Set<string>()
  // Polls sharing an end time can straddle a page, so a page resumes at its last one.
  let start: VotePollsByEndDateTimeBound = {timeMs: BigInt(Date.now()), included: true}
  for (;;) {
    const groups = await ctx.sdk.contestedResources.getVotePollsByEndDate(start, undefined, PROVED_QUERY_LIMIT, true)
    const polls = groups.flatMap(group => group.votePolls)
    polls
      .filter(poll => poll.contractId.base58() === DPNS_DATA_CONTRACT_ID && poll.documentTypeName === 'domain' && poll.indexName === DPNS_CONTESTED_INDEX)
      // Each index value comes as base64 of its serialized platform value.
      .forEach(poll => labels.add(indexBytesToString(base64.decode(poll.indexValues[1]))))
    const last = groups.at(-1)?.timestampMs
    if (polls.length < PROVED_QUERY_LIMIT || last == null || last === start.timeMs) break
    start = {timeMs: last, included: true}
  }

  const votes = await Promise.all([...labels].map(async label => ({label, vote: await contest(ctx, label)})))

  return {
    contests: votes.flatMap(({label, vote}) => (vote?.contenders ?? [])
      .filter(contender => identifiers.includes(contender.identifier))
      .map(contender => ({identifier: contender.identifier, label}))),
  }
}
