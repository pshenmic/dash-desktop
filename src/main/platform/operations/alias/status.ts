import {DPNS_DATA_CONTRACT_ID} from 'dash-platform-sdk/src/constants.js'
import stringToIndexValueBytes from 'dash-platform-sdk/src/utils/stringToIndexValueBytes.js'
import {ContestedStateResultType} from 'dash-platform-sdk/types.js'
import {DocumentWASM} from 'pshenmic-dpp'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, throwIfAborted} from '../types'
import {DPNS_CONTESTED_INDEX, DPNS_PARENT_DOMAIN, VOTE_POLL_DURATION_MS, VOTE_STATE_NOT_FOUND} from '../../constants'
import {AliasVote, AliasVoteOutcome} from '../../../src/types/Alias'
import {aliasStatusOf, scheduledVoteEnd} from '../../../src/utils/alias'

type Payload = PlatformOperations['aliasStatus']['payload']
type Result = PlatformOperations['aliasStatus']['result']

async function contest({sdk, network}: OperationContext, normalizedLabel: string): Promise<AliasVote | null> {
  const contract = await sdk.dataContracts.getDataContractByIdentifier(DPNS_DATA_CONTRACT_ID)
  try {
    const state = await sdk.contestedResources.getContestedResourceVoteState(
      contract, 'domain', DPNS_CONTESTED_INDEX,
      [DPNS_PARENT_DOMAIN, normalizedLabel].map(stringToIndexValueBytes),
      ContestedStateResultType.DOCUMENTS_AND_VOTE_TALLY, true,
    )
    const finished = state.finishedVoteInfo
    // Only a running poll still holds its contenders' documents.
    const createdAts = state.contenders.flatMap(({document}) =>
      document instanceof DocumentWASM && document.createdAt != null ? [Number(document.createdAt)] : [])
    return {
      // The SDK types the tally as `voteCount` but returns it as `voteTally`.
      contenders: state.contenders.map(contender => ({
        identifier: contender.identifier.base58(),
        votes: (contender as {voteTally?: number}).voteTally ?? 0,
      })),
      lockVotes: state.lockVoteTally ?? 0,
      abstainVotes: state.abstainVoteTally ?? 0,
      outcome: (finished?.type as AliasVoteOutcome | undefined) ?? null,
      winner: finished?.wonByIdentityId?.base58() ?? null,
      endsAt: finished != null
        ? Number(finished.finishedAtBlockTimeMs)
        : scheduledVoteEnd(createdAts, VOTE_POLL_DURATION_MS[network]),
    }
  } catch (err) {
    if (VOTE_STATE_NOT_FOUND.test(err instanceof Error ? err.message : String(err))) return null
    throw err
  }
}

export async function aliasStatus(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk} = ctx
  const {identifier, label} = payload
  const normalizedLabel = sdk.names.normalizeLabel(label)
  const isContested = sdk.names.testNameContested(`${label}.${DPNS_PARENT_DOMAIN}`)

  const [domain] = await sdk.documents.query(DPNS_DATA_CONTRACT_ID, 'domain', [
    ['normalizedParentDomainName', '==', DPNS_PARENT_DOMAIN],
    ['normalizedLabel', '==', normalizedLabel],
  ])
  throwIfAborted(ctx.signal)
  const vote = domain == null && isContested ? await contest(ctx, normalizedLabel) : null
  const ours = vote?.contenders.find(contender => contender.identifier === identifier)

  return {
    status: aliasStatusOf(identifier, domain?.ownerId.base58() ?? null, vote),
    isContested,
    documentId: domain?.id.base58() ?? null,
    votesFor: vote != null ? ours?.votes ?? 0 : null,
    votesLock: vote?.lockVotes ?? null,
    votesAbstain: vote?.abstainVotes ?? null,
    voteEndsAt: vote?.endsAt ?? null,
  }
}
