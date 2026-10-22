import type { Network } from '@renderer/api/types'
import { NAME_COLLATOR } from '@renderer/constants/listToolbar'
import { CONTEST_TIMING_COPY, ENDING_SOON_MS, VOTE_CHOICE_LABELS } from '@renderer/constants/masternodes'
import { ContestSegment, ContestSort, ContestStatus, VoteChoiceKind } from '@renderer/enums/Masternodes'
import type {
  ContestContenderDto,
  ContestContext,
  ContestFilter,
  ContestLeader,
  ContestSegmentCounts,
  ContestShares,
  ContestVoteSummary,
  MasternodeVoteDto,
  NameContestDto,
  VoteChoiceDto,
} from '@renderer/types/Masternodes'
import { formatCreationDate, formatTimestamp } from './date'
import { normalizeDpnsLabel, stripDpnsInput } from './dpnsLabel'
import { shortIdentifier } from './identifierFormat'
import { canVote, voteChoiceEquals } from './masternodes'

function voteShare(votes: number, total: number): number {
  return total === 0 ? 0 : votes / total
}

export function contestTotalVotes(contest: NameContestDto): number {
  return contest.contenders.reduce((sum, contender) => sum + contender.votes, contest.votesLock + contest.votesAbstain)
}

export function contenderName(contender: ContestContenderDto): string {
  return contender.displayName ?? shortIdentifier(contender.identifier)
}

export function voteChoiceLabel(choice: VoteChoiceDto, contest: NameContestDto): string {
  if (choice.kind !== VoteChoiceKind.TowardsIdentity) return VOTE_CHOICE_LABELS[choice.kind]
  const contender = contest.contenders.find(entry => entry.identifier === choice.identifier)
  return contender == null ? shortIdentifier(choice.identifier ?? '') : contenderName(contender)
}

export function isEndingSoon(contest: NameContestDto, now: number, network: Network): boolean {
  const left = contest.endsAt - now
  return contest.status === ContestStatus.Open && left > 0 && left <= ENDING_SOON_MS[network]
}

export function hasWalletContender(contest: NameContestDto, walletIdentifiers: ReadonlySet<string>): boolean {
  return contest.contenders.some(contender => walletIdentifiers.has(contender.identifier))
}

function votedByEligibleNode(contest: NameContestDto, context: ContestContext): boolean {
  const eligible = new Set(context.nodes.filter(canVote).map(node => node.proTxHash))
  return context.votes.some(vote => vote.normalizedLabel === contest.normalizedLabel && eligible.has(vote.proTxHash))
}

export function contestInSegment(contest: NameContestDto, segment: ContestSegment, context: ContestContext): boolean {
  switch (segment) {
    case ContestSegment.Open:
      return contest.status === ContestStatus.Open
    case ContestSegment.NotVoted:
      return contest.status === ContestStatus.Open && !votedByEligibleNode(contest, context)
    case ContestSegment.EndingSoon:
      return isEndingSoon(contest, context.now, context.network)
    case ContestSegment.Ended:
      return contest.status !== ContestStatus.Open
  }
}

function matchesContestQuery(contest: NameContestDto, query: string): boolean {
  return contest.normalizedLabel.includes(normalizeDpnsLabel(stripDpnsInput(query)))
}

export function filterContests(contests: NameContestDto[], filter: ContestFilter, context: ContestContext): NameContestDto[] {
  return contests.filter(contest => contestInSegment(contest, filter.segment, context)
    && (!filter.yourNamesOnly || hasWalletContender(contest, context.walletIdentifiers))
    && matchesContestQuery(contest, filter.query))
}

export function countContestSegments(
  contests: NameContestDto[],
  filter: Pick<ContestFilter, 'query' | 'yourNamesOnly'>,
  context: ContestContext,
): ContestSegmentCounts {
  const matched = contests.filter(contest => matchesContestQuery(contest, filter.query))
  const yours = matched.filter(contest => hasWalletContender(contest, context.walletIdentifiers))
  const scoped = filter.yourNamesOnly ? yours : matched
  const count = (segment: ContestSegment): number => scoped.filter(contest => contestInSegment(contest, segment, context)).length
  return {
    segments: {
      [ContestSegment.Open]: count(ContestSegment.Open),
      [ContestSegment.NotVoted]: count(ContestSegment.NotVoted),
      [ContestSegment.EndingSoon]: count(ContestSegment.EndingSoon),
      [ContestSegment.Ended]: count(ContestSegment.Ended),
    },
    yourNames: yours.length,
  }
}

function compareByEnd(a: NameContestDto, b: NameContestDto): number {
  const aOpen = a.status === ContestStatus.Open
  const bOpen = b.status === ContestStatus.Open
  if (aOpen !== bOpen) return aOpen ? -1 : 1
  return aOpen ? a.endsAt - b.endsAt : b.endsAt - a.endsAt
}

function compareContests(a: NameContestDto, b: NameContestDto, sort: ContestSort): number {
  switch (sort) {
    case ContestSort.EndingSoon:
      return compareByEnd(a, b)
    case ContestSort.MostVotes:
      return contestTotalVotes(b) - contestTotalVotes(a)
    case ContestSort.Name:
      return NAME_COLLATOR.compare(a.label, b.label)
    case ContestSort.Newest:
      return b.startedAt - a.startedAt
  }
}

export function sortContests(contests: NameContestDto[], sort: ContestSort): NameContestDto[] {
  return [...contests].sort((a, b) => compareContests(a, b, sort) || a.normalizedLabel.localeCompare(b.normalizedLabel))
}

function towards(contender: ContestContenderDto): VoteChoiceDto {
  return { kind: VoteChoiceKind.TowardsIdentity, identifier: contender.identifier }
}

export function contestLeader(contest: NameContestDto): ContestLeader {
  const total = contestTotalVotes(contest)
  const lock: ContestLeader = {
    choice: { kind: VoteChoiceKind.Lock, identifier: null },
    contender: null,
    votes: contest.votesLock,
    share: voteShare(contest.votesLock, total),
    tie: false,
  }
  const nobody: ContestLeader = { choice: null, contender: null, votes: 0, share: 0, tie: false }
  const leading = (contender: ContestContenderDto): ContestLeader => ({
    choice: towards(contender),
    contender,
    votes: contender.votes,
    share: voteShare(contender.votes, total),
    tie: false,
  })
  if (contest.status === ContestStatus.Locked) return lock
  if (contest.status === ContestStatus.NoWinner) return nobody
  if (contest.status === ContestStatus.Awarded) {
    const winner = contest.contenders.find(contender => contender.identifier === contest.winnerId)
    return winner == null ? nobody : leading(winner)
  }
  const [top, runnerUp] = [...contest.contenders].sort((a, b) => b.votes - a.votes)
  if (top == null) return contest.votesLock > 0 ? lock : nobody
  if (contest.votesLock > top.votes) return lock
  if (runnerUp != null && runnerUp.votes === top.votes) {
    return { choice: null, contender: null, votes: top.votes, share: voteShare(top.votes, total), tie: true }
  }
  return leading(top)
}

export function contenderShares(contest: NameContestDto): ContestShares {
  const total = contestTotalVotes(contest)
  const leader = contestLeader(contest).contender
  return {
    contenders: [...contest.contenders]
      .sort((a, b) => b.votes - a.votes || a.requestedAt - b.requestedAt)
      .map(contender => ({
        contender,
        share: voteShare(contender.votes, total),
        leading: leader?.identifier === contender.identifier,
      })),
    lock: { votes: contest.votesLock, share: voteShare(contest.votesLock, total) },
    abstain: { votes: contest.votesAbstain, share: voteShare(contest.votesAbstain, total) },
    total,
  }
}

export function contestVoteSummary(contest: NameContestDto, votes: MasternodeVoteDto[]): ContestVoteSummary {
  const ours = votes.filter(vote => vote.normalizedLabel === contest.normalizedLabel)
  const first = ours[0]
  if (first == null) return { choice: null, nodes: 0, mixed: false }
  const mixed = ours.some(vote => !voteChoiceEquals(vote.choice, first.choice))
  return { choice: mixed ? null : first.choice, nodes: ours.length, mixed }
}

export function contestTiming(contest: NameContestDto, now: number): string {
  const { joinUntil, joinClosed, votesCast, ended, separator } = CONTEST_TIMING_COPY
  if (contest.status !== ContestStatus.Open) return `${ended} ${formatCreationDate(new Date(contest.endsAt))}`
  const cast = `${contestTotalVotes(contest)} ${votesCast}`
  if (now < contest.joinClosesAt) return `${joinUntil} ${formatTimestamp(new Date(contest.joinClosesAt))}${separator}${cast}`
  return `${joinClosed}${separator}${cast}`
}

function withTally(contest: NameContestDto, choice: VoteChoiceDto, delta: number): NameContestDto {
  switch (choice.kind) {
    case VoteChoiceKind.Lock:
      return { ...contest, votesLock: Math.max(0, contest.votesLock + delta) }
    case VoteChoiceKind.Abstain:
      return { ...contest, votesAbstain: Math.max(0, contest.votesAbstain + delta) }
    case VoteChoiceKind.TowardsIdentity:
      return {
        ...contest,
        contenders: contest.contenders.map(contender => contender.identifier === choice.identifier
          ? { ...contender, votes: Math.max(0, contender.votes + delta) }
          : contender),
      }
  }
}

export function applyChoiceToContest(contest: NameContestDto, from: VoteChoiceDto | null, to: VoteChoiceDto, weight: number): NameContestDto {
  const withdrawn = from == null ? contest : withTally(contest, from, -weight)
  return withTally(withdrawn, to, weight)
}
