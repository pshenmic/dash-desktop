import { describe, expect, it } from 'vitest'
import {
  castVotesLabel,
  contenderCaption,
  contestOutcomeTitle,
  contestSegmentFor,
  contestSegmentOptions,
  contestSortFor,
  contestVoteBadge,
  currentVoteLine,
  dashPayUsernamesHref,
  eligibleNodeHashes,
  filterContenderShares,
  filterVoteRows,
  formatShare,
  formatVoteCount,
  hasVotingNode,
  leaderLabel,
  retryFailedLabel,
  rowsVotingPower,
  selectedNodesLine,
  selectedVoteRows,
  voteChangeWarningText,
  voteChangeWarnings,
  voteChoiceSummary,
  voteNodeRows,
  voteOutcomes,
  votesRecordedHeadline,
} from '../../src/renderer/src/utils/contestVoting'
import { contenderShares, contestLeader, contestVoteSummary } from '../../src/renderer/src/utils/nameContests'
import {
  ContestSegment,
  ContestSort,
  ContestStatus,
  MasternodeAccess,
  MasternodeStatus,
  MasternodeType,
  NodeVoteEligibility,
  VoteChoiceKind,
} from '../../src/renderer/src/enums/Masternodes'
import type {
  ContestContenderDto,
  MasternodeDto,
  MasternodeVoteDto,
  NameContestDto,
  VoteChoiceDto,
} from '../../src/renderer/src/types/Masternodes'

const NOW = new Date(2026, 9, 22, 12).getTime()
const HOUR = 3_600_000
const ALICE_ID = '4b9NkAbCdEfGhJkLmNoPqRsTuVwXyZk7pQ1'

function contender(identifier: string, votes: number, displayName: string | null = null, requestedLabel = 'alice'): ContestContenderDto {
  return { identifier, displayName, requestedLabel, votes, requestedAt: 0 }
}

function contest(overrides: Partial<NameContestDto> = {}): NameContestDto {
  return {
    normalizedLabel: 'a1ice',
    label: 'alice',
    status: ContestStatus.Open,
    contenders: [contender(ALICE_ID, 10, 'Alice Morgan'), contender('B', 5)],
    votesLock: 2,
    votesAbstain: 3,
    startedAt: NOW - HOUR,
    joinClosesAt: NOW + HOUR,
    endsAt: NOW + 2 * HOUR,
    winnerId: null,
    ...overrides,
  }
}

function node(label: string, overrides: Partial<MasternodeDto> = {}): MasternodeDto {
  return {
    proTxHash: label.toLowerCase(),
    label,
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
const FOR_ALICE: VoteChoiceDto = { kind: VoteChoiceKind.TowardsIdentity, identifier: ALICE_ID }

function vote(proTxHash: string, choice: VoteChoiceDto, votesUsed = 1): MasternodeVoteDto {
  return { proTxHash, normalizedLabel: 'a1ice', choice, votesUsed, castAt: 0 }
}

const NODES = [
  node('Atlas'),
  node('Northstar', { type: MasternodeType.Evo }),
  node('Lumen'),
  node('Orbit'),
  node('Sentinel', { access: MasternodeAccess.WatchOnly }),
  node('Beacon', { status: MasternodeStatus.PoseBanned }),
  node('Echo', { status: MasternodeStatus.NotListed }),
]

const VOTES = [vote('lumen', LOCK, 5), vote('orbit', LOCK, 3), vote('atlas', FOR_ALICE, 1)]

describe('voteNodeRows', () => {
  it('orders eligible nodes first, then by weight and label, with a reason for the rest', () => {
    const rows = voteNodeRows(NODES, VOTES, contest(), FOR_ALICE, NOW)
    expect(rows.map(row => [row.node.label, row.eligibility])).toEqual([
      ['Northstar', NodeVoteEligibility.Eligible],
      ['Orbit', NodeVoteEligibility.Eligible],
      ['Atlas', NodeVoteEligibility.SameChoice],
      ['Beacon', NodeVoteEligibility.Banned],
      ['Echo', NodeVoteEligibility.NotListed],
      ['Lumen', NodeVoteEligibility.NoVotesLeft],
      ['Sentinel', NodeVoteEligibility.NoKey],
    ])
    expect(rows.find(row => row.node.label === 'Northstar')).toMatchObject({ weight: 4, left: 5, vote: null })
    expect(rows.find(row => row.node.label === 'Orbit')).toMatchObject({ weight: 1, left: 2 })
  })

  it('marks every node as ended once voting is over', () => {
    const rows = voteNodeRows(NODES, VOTES, contest({ endsAt: NOW - 1 }), LOCK, NOW)
    expect(new Set(rows.map(row => row.eligibility))).toEqual(new Set([NodeVoteEligibility.Ended]))
  })
})

describe('node selection', () => {
  const rows = voteNodeRows(NODES, VOTES, contest(), FOR_ALICE, NOW)

  it('preselects only eligible nodes', () => {
    expect(eligibleNodeHashes(rows)).toEqual(['northstar', 'orbit'])
  })

  it('keeps only eligible nodes from a stale selection and sums their weight', () => {
    const chosen = selectedVoteRows(rows, new Set(['northstar', 'atlas', 'sentinel']))
    expect(chosen.map(row => row.node.label)).toEqual(['Northstar'])
    expect(rowsVotingPower(selectedVoteRows(rows, new Set(['northstar', 'orbit'])))).toBe(5)
  })

  it('warns for nodes that drop to one or no changes left', () => {
    const lowRows = voteNodeRows([node('Orbit'), node('Vega'), node('Atlas')], [vote('orbit', LOCK, 3), vote('vega', LOCK, 4)], contest(), FOR_ALICE, NOW)
    const warnings = voteChangeWarnings(lowRows)
    expect(warnings).toEqual([
      { proTxHash: 'orbit', label: 'Orbit', leftAfter: 1 },
      { proTxHash: 'vega', label: 'Vega', leftAfter: 0 },
    ])
    expect(warnings.map(voteChangeWarningText)).toEqual(['Orbit will have 1 change left', 'Vega will have no changes left'])
  })

  it('searches nodes by label and ProTxHash', () => {
    expect(filterVoteRows(rows, 'NORTH').map(row => row.node.label)).toEqual(['Northstar'])
    expect(filterVoteRows(rows, 'echo').map(row => row.node.label)).toEqual(['Echo'])
    expect(filterVoteRows(rows, ' ')).toHaveLength(rows.length)
  })

  it('knows whether any node can vote at all', () => {
    expect(hasVotingNode(NODES)).toBe(true)
    expect(hasVotingNode([node('Sentinel', { access: MasternodeAccess.WatchOnly }), node('Beacon', { status: MasternodeStatus.PoseBanned })])).toBe(false)
    expect(hasVotingNode([])).toBe(false)
  })
})

describe('contest list helpers', () => {
  it('limits ended contests to their own sorts', () => {
    expect(contestSortFor(ContestSegment.Ended, ContestSort.MostVotes)).toBe(ContestSort.EndingSoon)
    expect(contestSortFor(ContestSegment.Ended, ContestSort.Name)).toBe(ContestSort.Name)
    expect(contestSortFor(ContestSegment.Open, ContestSort.Newest)).toBe(ContestSort.Newest)
  })

  it('hides the not-voted segment without nodes', () => {
    const counts = {
      segments: { [ContestSegment.Open]: 38, [ContestSegment.NotVoted]: 31, [ContestSegment.EndingSoon]: 5, [ContestSegment.Ended]: 82 },
      yourNames: 2,
    }
    expect(contestSegmentOptions(counts, true).map(option => option.label)).toEqual(['Open · 38', 'Not voted · 31', 'Ending soon · 5', 'Ended · 82'])
    expect(contestSegmentOptions(counts, false).map(option => option.value)).toEqual([ContestSegment.Open, ContestSegment.EndingSoon, ContestSegment.Ended])
    expect(contestSegmentFor(ContestSegment.NotVoted, false)).toBe(ContestSegment.Open)
    expect(contestSegmentFor(ContestSegment.NotVoted, true)).toBe(ContestSegment.NotVoted)
  })

  it('formats shares and vote counts', () => {
    expect(formatShare(0.538)).toBe('54%')
    expect(formatShare(0)).toBe('0%')
    expect(formatVoteCount(1)).toBe('1 vote')
    expect(formatVoteCount(128)).toBe('128 votes')
  })

  it('labels the leader as a name, lock, tie or nobody', () => {
    expect(leaderLabel(contestLeader(contest()))).toBe('Alice Morgan')
    expect(leaderLabel(contestLeader(contest({ votesLock: 20 })))).toBe('Lock')
    expect(leaderLabel(contestLeader(contest({ contenders: [contender('A', 5), contender('B', 5)] })))).toBe('Tie')
    expect(leaderLabel(contestLeader(contest({ status: ContestStatus.NoWinner })))).toBe('—')
  })

  it('summarises our votes for the row badge and the vote panel', () => {
    const open = contest()
    expect(contestVoteBadge(contestVoteSummary(open, []), open)).toBeNull()
    expect(contestVoteBadge(contestVoteSummary(open, [vote('atlas', FOR_ALICE), vote('orbit', FOR_ALICE)]), open)).toBe('Alice Morgan · 2')
    expect(contestVoteBadge(contestVoteSummary(open, VOTES), open)).toBe('Mixed · 3')
    expect(currentVoteLine(contestVoteSummary(open, []), open)).toBe('Not voted')
    expect(currentVoteLine(contestVoteSummary(open, [vote('atlas', LOCK)]), open)).toBe('Lock on 1 node')
    expect(currentVoteLine(contestVoteSummary(open, [vote('atlas', FOR_ALICE), vote('orbit', FOR_ALICE)]), open)).toBe('Alice Morgan on 2 nodes')
  })
})

describe('contest detail helpers', () => {
  it('names the outcome of an ended contest', () => {
    expect(contestOutcomeTitle(contest({ status: ContestStatus.Awarded, winnerId: ALICE_ID }))).toBe('Awarded to Alice Morgan')
    expect(contestOutcomeTitle(contest({ status: ContestStatus.Locked }))).toBe('Locked by masternode vote')
    expect(contestOutcomeTitle(contest({ status: ContestStatus.NoWinner }))).toBe('No winner — the name is open again')
  })

  it('captions a contender with its identifier and a differing requested label', () => {
    expect(contenderCaption(contender(ALICE_ID, 0, 'Alice Morgan'), 'alice')).toBe(ALICE_ID)
    expect(contenderCaption(contender(ALICE_ID, 0, 'Alice Morgan', 'Alice'), 'alice')).toBe(`${ALICE_ID} · Requested as Alice.dash`)
    expect(contenderCaption(contender(ALICE_ID, 0, null, 'Alice'), 'alice')).toBe('Requested as Alice.dash')
    expect(contenderCaption(contender(ALICE_ID, 0, null), 'alice')).toBe('')
  })

  it('searches contenders by name, requested label and identifier', () => {
    const shares = contenderShares(contest({ contenders: [contender(ALICE_ID, 3, 'Alice Morgan'), contender('Bx9', 1, null, 'ALICE')] })).contenders
    expect(filterContenderShares(shares, 'morgan').map(share => share.contender.identifier)).toEqual([ALICE_ID])
    expect(filterContenderShares(shares, 'bx9').map(share => share.contender.identifier)).toEqual(['Bx9'])
    expect(filterContenderShares(shares, 'alice')).toHaveLength(2)
  })

  it('links a wallet contender to its usernames in DashPay', () => {
    expect(dashPayUsernamesHref(ALICE_ID)).toBe(`/dashpay?identity=${ALICE_ID}&tab=usernames`)
  })
})

describe('vote modal helpers', () => {
  it('describes the choice and the selected nodes', () => {
    const open = contest()
    expect(voteChoiceSummary(FOR_ALICE, open)).toBe(`Alice Morgan · ${ALICE_ID}`)
    expect(voteChoiceSummary({ kind: VoteChoiceKind.TowardsIdentity, identifier: 'B' }, open)).toBe('B')
    expect(voteChoiceSummary(LOCK, open)).toBe('Lock — nobody gets this name')
    expect(voteChoiceSummary(ABSTAIN, open)).toBe('Abstain')
    expect(selectedNodesLine(NODES.slice(0, 2))).toBe('2 selected — Atlas, Northstar')
    expect(selectedNodesLine(NODES)).toBe('7 selected — Atlas, Northstar, Lumen…')
    expect(castVotesLabel(1)).toBe('Cast 1 vote')
    expect(castVotesLabel(3)).toBe('Cast 3 votes')
  })

  it('lists failed nodes first with their labels and offers a retry', () => {
    const outcomes = voteOutcomes(NODES, [
      { proTxHash: 'atlas', ok: true, error: null },
      { proTxHash: 'vega', ok: false, error: 'Vote rejected' },
      { proTxHash: 'orbit', ok: true, error: null },
    ])
    expect(outcomes.map(outcome => [outcome.label, outcome.ok])).toEqual([['vega', false], ['Atlas', true], ['Orbit', true]])
    expect(votesRecordedHeadline(outcomes)).toBe('2 of 3 votes recorded')
    expect(votesRecordedHeadline(outcomes.slice(1, 2))).toBe('1 of 1 vote recorded')
    expect(retryFailedLabel(1)).toBe('Retry 1 failed')
  })
})
