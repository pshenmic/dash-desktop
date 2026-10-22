import { describe, expect, it } from 'vitest'
import {
  applyChoiceToContest,
  contenderShares,
  contestLeader,
  contestTiming,
  contestTotalVotes,
  contestVoteSummary,
  countContestSegments,
  filterContests,
  isEndingSoon,
  rankContenders,
  sortContests,
  towardsContender,
  voteChoiceLabel,
} from '../../src/renderer/src/utils/nameContests'
import {
  ContestSegment,
  ContestSort,
  ContestStatus,
  MasternodeAccess,
  MasternodeStatus,
  MasternodeType,
  VoteChoiceKind,
} from '../../src/renderer/src/enums/Masternodes'
import type {
  ContestContenderDto,
  ContestContext,
  MasternodeDto,
  MasternodeVoteDto,
  NameContestDto,
  VoteChoiceDto,
} from '../../src/renderer/src/types/Masternodes'

const NOW = new Date(2026, 9, 22, 12).getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE

function contender(identifier: string, votes: number, displayName: string | null = null, requestedAt = 0): ContestContenderDto {
  return { identifier, displayName, requestedLabel: identifier, votes, requestedAt }
}

function contest(label: string, overrides: Partial<NameContestDto> = {}): NameContestDto {
  return {
    normalizedLabel: label,
    label,
    status: ContestStatus.Open,
    contenders: [contender('A', 10, 'Alice Morgan'), contender('B', 5)],
    votesLock: 2,
    votesAbstain: 3,
    startedAt: NOW - HOUR,
    joinClosesAt: NOW + 10 * MINUTE,
    endsAt: NOW + 2 * HOUR,
    winnerId: null,
    ...overrides,
  }
}

function node(proTxHash: string, overrides: Partial<MasternodeDto> = {}): MasternodeDto {
  return {
    proTxHash,
    label: proTxHash,
    type: MasternodeType.Regular,
    status: MasternodeStatus.Active,
    posePenalty: 0,
    service: '',
    registeredHeight: 0,
    lastPaidHeight: null,
    payoutAddress: '',
    access: MasternodeAccess.VotingKey,
    addedAt: 0,
    ...overrides,
  }
}

const LOCK: VoteChoiceDto = { kind: VoteChoiceKind.Lock, identifier: null }
const ABSTAIN: VoteChoiceDto = { kind: VoteChoiceKind.Abstain, identifier: null }
const FOR_A: VoteChoiceDto = { kind: VoteChoiceKind.TowardsIdentity, identifier: 'A' }
const FOR_B: VoteChoiceDto = { kind: VoteChoiceKind.TowardsIdentity, identifier: 'B' }

function vote(proTxHash: string, normalizedLabel: string, choice: VoteChoiceDto): MasternodeVoteDto {
  return { proTxHash, normalizedLabel, choice, votesUsed: 1, castAt: 0 }
}

describe('contestLeader', () => {
  it('leads with the contender holding the most votes', () => {
    expect(contestLeader(contest('a'))).toMatchObject({ choice: FOR_A, votes: 10, share: 0.5, tie: false })
  })

  it('lets lock lead only when it is strictly above the top contender', () => {
    expect(contestLeader(contest('a', { votesLock: 11 }))).toMatchObject({ choice: LOCK, contender: null, votes: 11 })
    expect(contestLeader(contest('a', { votesLock: 10 })).choice).toEqual(FOR_A)
  })

  it('reports a tie between top contenders', () => {
    const tied = contest('a', { contenders: [contender('A', 7), contender('B', 7)] })
    expect(contestLeader(tied)).toMatchObject({ choice: null, contender: null, votes: 7, tie: true })
  })

  it('names the outcome of an ended contest', () => {
    expect(contestLeader(contest('a', { status: ContestStatus.Awarded, winnerId: 'B' })).choice).toEqual(FOR_B)
    expect(contestLeader(contest('a', { status: ContestStatus.Locked })).choice).toEqual(LOCK)
    expect(contestLeader(contest('a', { status: ContestStatus.NoWinner }))).toEqual({ choice: null, contender: null, votes: 0, share: 0, tie: false })
  })

  it('gives an unvoted single contender the lead with no share', () => {
    const single = contest('a', { contenders: [contender('A', 0)], votesLock: 0, votesAbstain: 0 })
    expect(contestLeader(single)).toMatchObject({ choice: FOR_A, votes: 0, share: 0, tie: false })
  })
})

describe('contenderShares', () => {
  it('sorts contenders by votes with shares of every vote cast', () => {
    const shares = contenderShares(contest('a', { contenders: [contender('B', 5), contender('A', 10)] }))
    expect(shares.total).toBe(20)
    expect(shares.contenders.map(entry => [entry.contender.identifier, entry.share, entry.leading])).toEqual([['A', 0.5, true], ['B', 0.25, false]])
    expect(shares.lock).toEqual({ votes: 2, share: 0.1 })
    expect(shares.abstain).toEqual({ votes: 3, share: 0.15 })
  })

  it('reports zero shares when nobody voted', () => {
    const empty = contenderShares(contest('a', { contenders: [contender('A', 0)], votesLock: 0, votesAbstain: 0 }))
    expect(empty.contenders[0].share).toBe(0)
    expect(empty.lock.share).toBe(0)
  })
})

describe('rankContenders', () => {
  it('orders by votes, the earliest request first on a tie, without touching the input', () => {
    const input = [contender('late', 5, null, 20), contender('top', 9), contender('early', 5, null, 10)]
    expect(rankContenders(input).map(entry => entry.identifier)).toEqual(['top', 'early', 'late'])
    expect(input.map(entry => entry.identifier)).toEqual(['late', 'top', 'early'])
  })
})

describe('towardsContender', () => {
  it('builds a vote for the contender identity', () => {
    expect(towardsContender(contender('A', 10))).toEqual(FOR_A)
  })
})

describe('isEndingSoon', () => {
  it('uses an absolute threshold per network', () => {
    const tenMinutes = contest('a', { endsAt: NOW + 10 * MINUTE })
    const twentyMinutes = contest('a', { endsAt: NOW + 20 * MINUTE })
    expect(isEndingSoon(tenMinutes, NOW, 'testnet')).toBe(true)
    expect(isEndingSoon(twentyMinutes, NOW, 'testnet')).toBe(false)
    expect(isEndingSoon(twentyMinutes, NOW, 'mainnet')).toBe(true)
    expect(isEndingSoon(contest('a', { endsAt: NOW + 25 * HOUR }), NOW, 'mainnet')).toBe(false)
  })

  it('is never true for an ended or overdue contest', () => {
    expect(isEndingSoon(contest('a', { status: ContestStatus.Awarded, endsAt: NOW + MINUTE }), NOW, 'testnet')).toBe(false)
    expect(isEndingSoon(contest('a', { endsAt: NOW - MINUTE }), NOW, 'testnet')).toBe(false)
  })
})

describe('contest segments', () => {
  const contests = [
    contest('a11ce', { contenders: [contender('Mine', 3), contender('B', 1)] }),
    contest('b0b', { endsAt: NOW + 5 * MINUTE }),
    contest('car01'),
    contest('dave', { status: ContestStatus.Awarded, winnerId: 'A' }),
  ]
  const context: ContestContext = {
    nodes: [node('orbit'), node('beacon', { status: MasternodeStatus.PoseBanned })],
    votes: [vote('orbit', 'a11ce', FOR_A), vote('beacon', 'car01', LOCK)],
    walletIdentifiers: new Set(['Mine']),
    now: NOW,
    network: 'testnet',
  }

  it('counts open, not voted by an eligible node, ending soon and ended contests', () => {
    expect(countContestSegments(contests, { query: '', yourNamesOnly: false }, context)).toEqual({
      segments: {
        [ContestSegment.Open]: 3,
        [ContestSegment.NotVoted]: 2,
        [ContestSegment.EndingSoon]: 1,
        [ContestSegment.Ended]: 1,
      },
      yourNames: 1,
    })
  })

  it('filters by segment, homograph-insensitive name and our own contenders', () => {
    const filter = (segment: ContestSegment, query = '', yourNamesOnly = false) =>
      filterContests(contests, { segment, query, yourNamesOnly }, context).map(entry => entry.normalizedLabel)
    expect(filter(ContestSegment.NotVoted)).toEqual(['b0b', 'car01'])
    expect(filter(ContestSegment.Open, 'ALICE')).toEqual(['a11ce'])
    expect(filter(ContestSegment.Open, '', true)).toEqual(['a11ce'])
    expect(filter(ContestSegment.Ended)).toEqual(['dave'])
  })

  it('narrows the counts to our names when the chip is on', () => {
    expect(countContestSegments(contests, { query: '', yourNamesOnly: true }, context).segments[ContestSegment.Open]).toBe(1)
  })
})

describe('sortContests', () => {
  const open = contest('open-late', { endsAt: NOW + 3 * HOUR, startedAt: NOW - 3 * HOUR })
  const soon = contest('open-soon', { endsAt: NOW + HOUR, startedAt: NOW - HOUR, contenders: [contender('A', 100)] })
  const endedRecent = contest('ended-recent', { status: ContestStatus.Locked, endsAt: NOW - HOUR, startedAt: NOW - 4 * HOUR })
  const endedOld = contest('ended-old', { status: ContestStatus.Awarded, endsAt: NOW - 5 * HOUR, startedAt: NOW - 9 * HOUR })
  const all = [endedOld, open, endedRecent, soon]
  const labels = (sort: ContestSort) => sortContests(all, sort).map(entry => entry.label)

  it('puts the nearest end first: soonest open, then most recently ended', () => {
    expect(labels(ContestSort.EndingSoon)).toEqual(['open-soon', 'open-late', 'ended-recent', 'ended-old'])
  })

  it('sorts by total votes, by name and by start date', () => {
    expect(labels(ContestSort.MostVotes)[0]).toBe('open-soon')
    expect(labels(ContestSort.Name)).toEqual(['ended-old', 'ended-recent', 'open-late', 'open-soon'])
    expect(labels(ContestSort.Newest)).toEqual(['open-soon', 'open-late', 'ended-recent', 'ended-old'])
  })
})

describe('contestVoteSummary', () => {
  const alice = contest('a11ce')

  it('summarises our votes as one choice, mixed, or none', () => {
    expect(contestVoteSummary(alice, [])).toEqual({ choice: null, nodes: 0, mixed: false })
    expect(contestVoteSummary(alice, [vote('n1', 'a11ce', FOR_A), vote('n2', 'a11ce', FOR_A), vote('n3', 'other', LOCK)]))
      .toEqual({ choice: FOR_A, nodes: 2, mixed: false })
    expect(contestVoteSummary(alice, [vote('n1', 'a11ce', FOR_A), vote('n2', 'a11ce', FOR_B)]))
      .toEqual({ choice: null, nodes: 2, mixed: true })
  })

  it('labels a choice with the contender name or the choice kind', () => {
    expect(voteChoiceLabel(FOR_A, alice)).toBe('Alice Morgan')
    expect(voteChoiceLabel({ kind: VoteChoiceKind.TowardsIdentity, identifier: '4b9NkQwzP3Jbk7pQ1' }, alice)).toBe('4b9NkQwzP3Jbk7pQ1')
    expect(voteChoiceLabel(FOR_B, alice)).toBe('B')
    expect(voteChoiceLabel(LOCK, alice)).toBe('Lock')
  })
})

describe('contestTiming', () => {
  it('describes the join window and the vote count while open', () => {
    expect(contestTiming(contest('a'), NOW)).toMatch(/^New contenders until 22 Oct 2026, 12:10 · 20 votes cast$/)
    expect(contestTiming(contest('a'), NOW + 20 * MINUTE)).toBe('New contenders can’t join · 20 votes cast')
  })

  it('dates an ended contest', () => {
    expect(contestTiming(contest('a', { status: ContestStatus.Locked, endsAt: NOW }), NOW)).toBe('Voting ended 22 Oct 2026')
  })
})

describe('applyChoiceToContest', () => {
  it('moves a node’s weight from its previous choice to the new one', () => {
    const moved = applyChoiceToContest(contest('a'), FOR_A, LOCK, 4)
    expect(moved.contenders.find(entry => entry.identifier === 'A')?.votes).toBe(6)
    expect(moved.votesLock).toBe(6)
    expect(contestTotalVotes(moved)).toBe(contestTotalVotes(contest('a')))
  })

  it('adds a first vote without withdrawing anything', () => {
    const first = applyChoiceToContest(contest('a'), null, ABSTAIN, 1)
    expect(first.votesAbstain).toBe(4)
    expect(contestTotalVotes(first)).toBe(21)
  })
})
