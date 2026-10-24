import { DASHPAY_PARAMS, DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import { NAME_COLLATOR } from '@renderer/constants/listToolbar'
import { COUNT_NOUNS } from '@renderer/constants/masternodeNodes'
import { CONTEST_SEGMENT_LABELS, ENDED_CONTEST_SORT_OPTIONS, MASTERNODE_VOTE_WEIGHT, VOTE_CHOICE_LABELS } from '@renderer/constants/masternodes'
import {
  CONTEST_DETAIL_COPY,
  CONTEST_LIST_SEPARATOR,
  CONTEST_OUTCOME_COPY,
  CONTEST_ROW_COPY,
  PERCENT_SCALE,
  VOTE_CHANGE_WARNING_LEFT,
  VOTE_MODAL_COPY,
  VOTE_MODAL_NODE_PREVIEW,
  VOTE_PANEL_COPY,
} from '@renderer/constants/nameContests'
import { DashPayTab } from '@renderer/enums/DashPay'
import { ContestSegment, ContestSort, ContestStatus, NodeVoteEligibility, VoteChoiceKind } from '@renderer/enums/Masternodes'
import type {
  ContenderShare,
  ContestContenderDto,
  ContestLeader,
  ContestSegmentCounts,
  ContestVoteSummary,
  MasternodeDto,
  MasternodeVoteDto,
  MasternodeVoteResultDto,
  NameContestDto,
  VoteChoiceDto,
} from '@renderer/types/Masternodes'
import type { VoteChangeWarning, VoteNodeRow, VoteOutcome } from '@renderer/types/NameContests'
import type { SegmentOption } from '@renderer/types/SegmentedControl'
import { countLabel } from './countLabel'
import { dashPayHref } from './dashPayIdentity'
import { fullDpnsName } from './dpnsLabel'
import { canVote, nodeVoteEligibility, nodeVoteOn, votesLeft } from './masternodes'
import { contenderName, voteChoiceLabel } from './nameContests'

function isEligible(row: VoteNodeRow): boolean {
  return row.eligibility === NodeVoteEligibility.Eligible
}

export function voteNodeRows(
  nodes: MasternodeDto[],
  votes: MasternodeVoteDto[],
  contest: NameContestDto,
  choice: VoteChoiceDto | null,
  now: number,
): VoteNodeRow[] {
  return nodes
    .map((node) => {
      const vote = nodeVoteOn(votes, node.proTxHash, contest.normalizedLabel)
      return {
        node,
        vote,
        eligibility: nodeVoteEligibility(node, vote, choice, contest, now),
        weight: MASTERNODE_VOTE_WEIGHT[node.type],
        left: votesLeft(vote),
      }
    })
    .sort((a, b) => Number(isEligible(b)) - Number(isEligible(a))
      || b.weight - a.weight
      || NAME_COLLATOR.compare(a.node.label, b.node.label))
}

export function eligibleNodeHashes(rows: VoteNodeRow[]): string[] {
  return rows.filter(isEligible).map(row => row.node.proTxHash)
}

export function selectedVoteRows(rows: VoteNodeRow[], selected: ReadonlySet<string>): VoteNodeRow[] {
  return rows.filter(row => isEligible(row) && selected.has(row.node.proTxHash))
}

export function rowsVotingPower(rows: VoteNodeRow[]): number {
  return rows.reduce((sum, row) => sum + row.weight, 0)
}

export function voteChangeWarnings(rows: VoteNodeRow[]): VoteChangeWarning[] {
  return rows
    .map(row => ({ proTxHash: row.node.proTxHash, label: row.node.label, leftAfter: Math.max(0, row.left - 1) }))
    .filter(warning => warning.leftAfter <= VOTE_CHANGE_WARNING_LEFT)
}

export function voteChangeWarningText(warning: VoteChangeWarning): string {
  const left = warning.leftAfter === 0 ? VOTE_PANEL_COPY.noChangesLeft : VOTE_PANEL_COPY.oneChangeLeft
  return `${warning.label} ${VOTE_PANEL_COPY.willHave} ${left}`
}

export function filterVoteRows(rows: VoteNodeRow[], query: string): VoteNodeRow[] {
  const needle = query.trim().toLowerCase()
  return rows.filter(row => [row.node.label, row.node.proTxHash].some(value => value.toLowerCase().includes(needle)))
}

export function filterContenderShares(shares: ContenderShare[], query: string): ContenderShare[] {
  const needle = query.trim().toLowerCase()
  return shares.filter(({ contender }) => [contender.displayName ?? '', contender.requestedLabel, contender.identifier]
    .some(value => value.toLowerCase().includes(needle)))
}

export function hasVotingNode(nodes: MasternodeDto[]): boolean {
  return nodes.some(canVote)
}

export function contestSortFor(segment: ContestSegment, sort: ContestSort): ContestSort {
  if (segment !== ContestSegment.Ended || ENDED_CONTEST_SORT_OPTIONS.some(option => option.value === sort)) return sort
  return ContestSort.EndingSoon
}

export function contestSegmentFor(segment: ContestSegment, hasNodes: boolean): ContestSegment {
  return segment === ContestSegment.NotVoted && !hasNodes ? ContestSegment.Open : segment
}

export function contestSegmentOptions(counts: ContestSegmentCounts, hasNodes: boolean): SegmentOption<ContestSegment>[] {
  return Object.values(ContestSegment)
    .filter(segment => hasNodes || segment !== ContestSegment.NotVoted)
    .map(segment => ({ value: segment, label: `${CONTEST_SEGMENT_LABELS[segment]}${CONTEST_LIST_SEPARATOR}${counts.segments[segment]}` }))
}

export function formatShare(share: number): string {
  return `${Math.round(share * PERCENT_SCALE)}%`
}

export function formatVoteCount(votes: number): string {
  return countLabel(votes, COUNT_NOUNS.vote)
}

export function leaderLabel(leader: ContestLeader): string {
  if (leader.tie) return CONTEST_ROW_COPY.tie
  if (leader.contender != null) return contenderName(leader.contender)
  if (leader.choice != null) return VOTE_CHOICE_LABELS[leader.choice.kind]
  return CONTEST_ROW_COPY.none
}

export function contestVoteBadge(summary: ContestVoteSummary, contest: NameContestDto): string | null {
  if (summary.nodes === 0) return null
  const choice = summary.mixed || summary.choice == null ? CONTEST_ROW_COPY.mixed : voteChoiceLabel(summary.choice, contest)
  return `${choice}${CONTEST_LIST_SEPARATOR}${summary.nodes}`
}

export function currentVoteLine(summary: ContestVoteSummary, contest: NameContestDto): string {
  if (summary.nodes === 0) return VOTE_PANEL_COPY.notVoted
  const choice = summary.mixed || summary.choice == null ? CONTEST_ROW_COPY.mixed : voteChoiceLabel(summary.choice, contest)
  return `${choice} ${VOTE_PANEL_COPY.on} ${countLabel(summary.nodes, COUNT_NOUNS.node)}`
}

export function contestOutcomeTitle(contest: NameContestDto): string {
  if (contest.status === ContestStatus.Locked) return CONTEST_OUTCOME_COPY.locked
  const winner = contest.contenders.find(contender => contender.identifier === contest.winnerId)
  if (contest.status === ContestStatus.Awarded && winner != null) return `${CONTEST_OUTCOME_COPY.awarded} ${contenderName(winner)}`
  return CONTEST_OUTCOME_COPY.noWinner
}

export function voteChoiceSummary(choice: VoteChoiceDto, contest: NameContestDto): string {
  if (choice.kind === VoteChoiceKind.Lock) return CONTEST_DETAIL_COPY.lock
  if (choice.kind === VoteChoiceKind.Abstain) return VOTE_MODAL_COPY.abstain
  const identifier = choice.identifier ?? ''
  const name = voteChoiceLabel(choice, contest)
  return name === identifier ? name : `${name}${CONTEST_LIST_SEPARATOR}${identifier}`
}

export function contenderCaption(contender: ContestContenderDto, contestLabel: string): string {
  const parts = [
    contender.displayName == null ? null : contender.identifier,
    contender.requestedLabel === contestLabel ? null : `${CONTEST_DETAIL_COPY.requestedAs} ${fullDpnsName(contender.requestedLabel)}`,
  ]
  return parts.filter(part => part != null).join(CONTEST_LIST_SEPARATOR)
}

export function dashPayUsernamesHref(identifier: string): string {
  return dashPayHref(DASHPAY_ROUTES.root, identifier, { [DASHPAY_PARAMS.tab]: DashPayTab.Usernames })
}

export function selectedNodesLine(nodes: MasternodeDto[]): string {
  const preview = nodes.slice(0, VOTE_MODAL_NODE_PREVIEW).map(node => node.label).join(', ')
  const more = nodes.length > VOTE_MODAL_NODE_PREVIEW ? VOTE_MODAL_COPY.ellipsis : ''
  return `${nodes.length} ${VOTE_MODAL_COPY.selected}${VOTE_MODAL_COPY.dash}${preview}${more}`
}

export function castVotesLabel(count: number): string {
  return `${VOTE_MODAL_COPY.cast} ${countLabel(count, COUNT_NOUNS.vote)}`
}

export function voteOutcomes(nodes: MasternodeDto[], results: MasternodeVoteResultDto[]): VoteOutcome[] {
  const labels = new Map(nodes.map(node => [node.proTxHash, node.label]))
  return results
    .map(result => ({ ...result, label: labels.get(result.proTxHash) ?? result.proTxHash }))
    .sort((a, b) => Number(a.ok) - Number(b.ok) || NAME_COLLATOR.compare(a.label, b.label))
}

export function votesRecordedHeadline(outcomes: VoteOutcome[]): string {
  const ok = outcomes.filter(outcome => outcome.ok).length
  return `${ok} ${VOTE_MODAL_COPY.of} ${countLabel(outcomes.length, COUNT_NOUNS.vote)} ${VOTE_MODAL_COPY.recorded}`
}

export function retryFailedLabel(failed: number): string {
  return `${VOTE_MODAL_COPY.retry} ${failed} ${VOTE_MODAL_COPY.failed}`
}
