import { COUNT_NOUNS, NODE_DETAIL_COPY, NODE_WEIGHT_PREFIX, NO_VALUE_MARK, SUMMARY_COPY } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_VOTE_WEIGHT, NODE_SEGMENT_LABELS } from '@renderer/constants/masternodes'
import { AddNodeSource, MasternodeAccess, MasternodeStatus, MasternodeType, NodeSegment } from '@renderer/enums/Masternodes'
import type { MasternodeDto, MasternodeVoteDto, NodeSegmentCounts, VotingPowerSummary } from '@renderer/types/Masternodes'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export function countLabel(count: number, noun: { one: string; many: string }): string {
  return `${count} ${count === 1 ? noun.one : noun.many}`
}

export function nodeSegmentOptions(counts: NodeSegmentCounts): SegmentOption<NodeSegment>[] {
  return Object.values(NodeSegment).map(value => ({
    value,
    label: `${NODE_SEGMENT_LABELS[value]}${SUMMARY_COPY.separator}${counts[value]}`,
  }))
}

export function nodeWeightLabel(node: Pick<MasternodeDto, 'access' | 'type'>): string {
  if (node.access === MasternodeAccess.WatchOnly) return NO_VALUE_MARK
  return `${NODE_WEIGHT_PREFIX}${MASTERNODE_VOTE_WEIGHT[node.type]}`
}

export function votingPowerBreakdown(summary: VotingPowerSummary): string {
  const parts: string[] = []
  if (summary.evonodes > 0) {
    parts.push(`${countLabel(summary.evonodes, COUNT_NOUNS.evonode)} ${NODE_WEIGHT_PREFIX}${MASTERNODE_VOTE_WEIGHT[MasternodeType.Evo]}`)
  }
  if (summary.masternodes > 0) {
    parts.push(`${countLabel(summary.masternodes, COUNT_NOUNS.masternode)} ${NODE_WEIGHT_PREFIX}${MASTERNODE_VOTE_WEIGHT[MasternodeType.Regular]}`)
  }
  return parts.join(SUMMARY_COPY.separator)
}

export function isNodeAlreadyAdded(candidate: Pick<MasternodeDto, 'proTxHash'>, nodes: MasternodeDto[], source: AddNodeSource): boolean {
  const existing = nodes.find(node => node.proTxHash === candidate.proTxHash)
  if (existing == null) return false
  return source === AddNodeSource.WatchOnly || existing.access === MasternodeAccess.VotingKey
}

export function addedVotingPower(candidates: MasternodeDto[], selected: ReadonlySet<string>): number {
  return candidates
    .filter(node => selected.has(node.proTxHash) && node.status === MasternodeStatus.Active)
    .reduce((sum, node) => sum + MASTERNODE_VOTE_WEIGHT[node.type], 0)
}

export function formatBlockHeight(height: number): string {
  return `${NODE_DETAIL_COPY.heightPrefix}${height.toLocaleString('en-US')}`
}

export function nodeVotes(votes: MasternodeVoteDto[], proTxHash: string): MasternodeVoteDto[] {
  return votes
    .filter(vote => vote.proTxHash === proTxHash)
    .sort((a, b) => b.castAt - a.castAt)
}
