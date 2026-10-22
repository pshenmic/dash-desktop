import { NAME_COLLATOR } from '@renderer/constants/listToolbar'
import { MASTERNODE_VOTE_WEIGHT, VOTES_PER_NODE_PER_POLL } from '@renderer/constants/masternodes'
import {
  ContestStatus,
  MasternodeAccess,
  MasternodeStatus,
  MasternodeType,
  NodeSegment,
  NodeVoteEligibility,
  VoteChoiceKind,
} from '@renderer/enums/Masternodes'
import type {
  MasternodeDto,
  MasternodeVoteDto,
  MasternodeVoteResultDto,
  NameContestDto,
  NodeSegmentCounts,
  VoteChoiceDto,
  VotingPowerSummary,
} from '@renderer/types/Masternodes'

export function canVote(node: MasternodeDto): boolean {
  return node.access === MasternodeAccess.VotingKey && node.status === MasternodeStatus.Active
}

export function votingPower(nodes: MasternodeDto[]): VotingPowerSummary {
  const voting = nodes.filter(canVote)
  const evonodes = voting.filter(node => node.type === MasternodeType.Evo).length
  return {
    votes: voting.reduce((sum, node) => sum + MASTERNODE_VOTE_WEIGHT[node.type], 0),
    evonodes,
    masternodes: voting.length - evonodes,
  }
}

export function nodeInSegment(node: MasternodeDto, segment: NodeSegment): boolean {
  switch (segment) {
    case NodeSegment.CanVote:
      return canVote(node)
    case NodeSegment.WatchOnly:
      return node.access === MasternodeAccess.WatchOnly
    case NodeSegment.Issues:
      return hasIssue(node)
    default:
      return true
  }
}

export function filterNodes(nodes: MasternodeDto[], query: string, segment: NodeSegment): MasternodeDto[] {
  const needle = query.trim().toLowerCase()
  return nodes.filter(node => nodeInSegment(node, segment)
    && (needle === '' || [node.label, node.proTxHash, node.service].some(value => value.toLowerCase().includes(needle))))
}

export function countNodeSegments(nodes: MasternodeDto[], query: string): NodeSegmentCounts {
  const matched = filterNodes(nodes, query, NodeSegment.All)
  const count = (segment: NodeSegment): number => matched.filter(node => nodeInSegment(node, segment)).length
  return {
    [NodeSegment.All]: matched.length,
    [NodeSegment.CanVote]: count(NodeSegment.CanVote),
    [NodeSegment.WatchOnly]: count(NodeSegment.WatchOnly),
    [NodeSegment.Issues]: count(NodeSegment.Issues),
  }
}

function hasIssue(node: MasternodeDto): boolean {
  return node.status !== MasternodeStatus.Active
}

export function sortNodes(nodes: MasternodeDto[]): MasternodeDto[] {
  return [...nodes].sort((a, b) => Number(hasIssue(b)) - Number(hasIssue(a))
    || Number(canVote(b)) - Number(canVote(a))
    || NAME_COLLATOR.compare(a.label, b.label))
}

export function voteChoiceEquals(a: VoteChoiceDto, b: VoteChoiceDto): boolean {
  return a.kind === b.kind && (a.kind !== VoteChoiceKind.TowardsIdentity || a.identifier === b.identifier)
}

export function votesLeft(vote: Pick<MasternodeVoteDto, 'votesUsed'> | null): number {
  return Math.max(0, VOTES_PER_NODE_PER_POLL - (vote?.votesUsed ?? 0))
}

export function nodeVoteEligibility(
  node: MasternodeDto,
  vote: MasternodeVoteDto | null,
  choice: VoteChoiceDto | null,
  contest: NameContestDto,
  now: number,
): NodeVoteEligibility {
  if (contest.status !== ContestStatus.Open || contest.endsAt <= now) return NodeVoteEligibility.Ended
  if (node.access !== MasternodeAccess.VotingKey) return NodeVoteEligibility.NoKey
  if (node.status === MasternodeStatus.PoseBanned) return NodeVoteEligibility.Banned
  if (node.status === MasternodeStatus.NotListed) return NodeVoteEligibility.NotListed
  if (votesLeft(vote) === 0) return NodeVoteEligibility.NoVotesLeft
  if (vote != null && choice != null && voteChoiceEquals(vote.choice, choice)) return NodeVoteEligibility.SameChoice
  return NodeVoteEligibility.Eligible
}

export function applyVoteResults(
  votes: MasternodeVoteDto[],
  results: MasternodeVoteResultDto[],
  normalizedLabel: string,
  choice: VoteChoiceDto,
  now: number,
): MasternodeVoteDto[] {
  const succeeded = results.filter(result => result.ok).map(result => result.proTxHash)
  const voted = new Set(votes.filter(vote => vote.normalizedLabel === normalizedLabel).map(vote => vote.proTxHash))
  const updated = votes.map(vote => vote.normalizedLabel === normalizedLabel && succeeded.includes(vote.proTxHash)
    ? { ...vote, choice, votesUsed: vote.votesUsed + 1, castAt: now }
    : vote)
  const added = succeeded
    .filter(proTxHash => !voted.has(proTxHash))
    .map(proTxHash => ({ proTxHash, normalizedLabel, choice, votesUsed: 1, castAt: now }))
  return [...updated, ...added]
}
