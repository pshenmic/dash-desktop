import { describe, expect, it } from 'vitest'
import {
  applyVoteResults,
  canVote,
  countNodeSegments,
  filterNodes,
  nodeVoteEligibility,
  nodeVoteOn,
  sortNodes,
  toggledSet,
  voteChoiceEquals,
  votesLeft,
  votingPower,
} from '../../src/renderer/src/utils/masternodes'
import {
  ContestStatus,
  MasternodeAccess,
  MasternodeStatus,
  MasternodeType,
  NodeSegment,
  NodeVoteEligibility,
  VoteChoiceKind,
} from '../../src/renderer/src/enums/Masternodes'
import type { MasternodeDto, MasternodeVoteDto, NameContestDto, VoteChoiceDto } from '../../src/renderer/src/types/Masternodes'

function node(label: string, overrides: Partial<MasternodeDto> = {}): MasternodeDto {
  return {
    proTxHash: `${label.toLowerCase()}`.padEnd(64, 'f'),
    label,
    type: MasternodeType.Regular,
    status: MasternodeStatus.Active,
    posePenalty: 0,
    service: '1.2.3.4:19999',
    registeredHeight: 1_000,
    lastPaidHeight: null,
    payoutAddress: 'yPayout',
    access: MasternodeAccess.VotingKey,
    addedAt: 0,
    ...overrides,
  }
}

const NOW = 1_000_000
const contest: NameContestDto = {
  normalizedLabel: 'a11ce',
  label: 'alice',
  status: ContestStatus.Open,
  contenders: [],
  votesLock: 0,
  votesAbstain: 0,
  startedAt: 0,
  joinClosesAt: NOW,
  endsAt: NOW + 60_000,
  winnerId: null,
}
const LOCK: VoteChoiceDto = { kind: VoteChoiceKind.Lock, identifier: null }
const FOR_A: VoteChoiceDto = { kind: VoteChoiceKind.TowardsIdentity, identifier: 'A' }
const FOR_B: VoteChoiceDto = { kind: VoteChoiceKind.TowardsIdentity, identifier: 'B' }

function vote(proTxHash: string, choice: VoteChoiceDto, votesUsed: number, normalizedLabel = 'a11ce'): MasternodeVoteDto {
  return { proTxHash, normalizedLabel, choice, votesUsed, castAt: 0 }
}

const operator = [
  ...Array.from({ length: 5 }, (_, index) => node(`Evo${index}`, { type: MasternodeType.Evo })),
  node('EvoWatch', { type: MasternodeType.Evo, access: MasternodeAccess.WatchOnly }),
  ...Array.from({ length: 12 }, (_, index) => node(`Reg${index}`)),
  node('Banned1', { status: MasternodeStatus.PoseBanned }),
  node('Banned2', { status: MasternodeStatus.PoseBanned }),
  node('Gone', { status: MasternodeStatus.NotListed }),
  ...Array.from({ length: 3 }, (_, index) => node(`Watch${index}`, { access: MasternodeAccess.WatchOnly })),
]

describe('voting power', () => {
  it('counts only active nodes holding a voting key, evonodes ×4', () => {
    expect(canVote(node('a'))).toBe(true)
    expect(canVote(node('b', { access: MasternodeAccess.WatchOnly }))).toBe(false)
    expect(canVote(node('c', { status: MasternodeStatus.PoseBanned }))).toBe(false)
    expect(votingPower(operator)).toEqual({ votes: 32, evonodes: 5, masternodes: 12 })
  })
})

describe('node segments', () => {
  it('counts the operator preset as 24 / 17 / 4 / 3', () => {
    expect(countNodeSegments(operator, '')).toEqual({
      [NodeSegment.All]: 24,
      [NodeSegment.CanVote]: 17,
      [NodeSegment.WatchOnly]: 4,
      [NodeSegment.Issues]: 3,
    })
  })

  it('searches label, ProTxHash and service, case-insensitively, within a segment', () => {
    const nodes = [node('Orbit'), node('Atlas', { service: '10.0.0.9:9999' }), node('Sentinel', { access: MasternodeAccess.WatchOnly })]
    expect(filterNodes(nodes, 'orb', NodeSegment.All).map(entry => entry.label)).toEqual(['Orbit'])
    expect(filterNodes(nodes, '10.0.0', NodeSegment.All).map(entry => entry.label)).toEqual(['Atlas'])
    expect(filterNodes(nodes, 'SENTINELFF', NodeSegment.All).map(entry => entry.label)).toEqual(['Sentinel'])
    expect(filterNodes(nodes, '', NodeSegment.WatchOnly).map(entry => entry.label)).toEqual(['Sentinel'])
  })

  it('sorts issues first, then nodes that can vote, then by label', () => {
    const nodes = [node('Zeta'), node('Watch', { access: MasternodeAccess.WatchOnly }), node('Banned', { status: MasternodeStatus.PoseBanned }), node('Alpha')]
    expect(sortNodes(nodes).map(entry => entry.label)).toEqual(['Banned', 'Alpha', 'Zeta', 'Watch'])
  })
})

describe('votesLeft', () => {
  it('allows five votes per node per poll', () => {
    expect(votesLeft(null)).toBe(5)
    expect(votesLeft({ votesUsed: 4 })).toBe(1)
    expect(votesLeft({ votesUsed: 5 })).toBe(0)
    expect(votesLeft({ votesUsed: 7 })).toBe(0)
  })
})

describe('nodeVoteOn', () => {
  it('finds the vote of a node on one contest only', () => {
    const atlas = node('Atlas').proTxHash
    const onAlice = vote(atlas, LOCK, 1)
    const votes = [vote(atlas, FOR_A, 2, 'b0b'), onAlice, vote(node('Orbit').proTxHash, FOR_B, 1)]
    expect(nodeVoteOn(votes, atlas, 'a11ce')).toBe(onAlice)
    expect(nodeVoteOn(votes, atlas, 'missing')).toBeNull()
  })
})

describe('nodeVoteEligibility', () => {
  const orbit = node('Orbit')

  it('gives the reason a node cannot vote, in a fixed order', () => {
    expect(nodeVoteEligibility(node('w', { access: MasternodeAccess.WatchOnly, status: MasternodeStatus.PoseBanned }), null, LOCK, contest, NOW))
      .toBe(NodeVoteEligibility.NoKey)
    expect(nodeVoteEligibility(node('b', { status: MasternodeStatus.PoseBanned }), null, LOCK, contest, NOW)).toBe(NodeVoteEligibility.Banned)
    expect(nodeVoteEligibility(node('g', { status: MasternodeStatus.NotListed }), null, LOCK, contest, NOW)).toBe(NodeVoteEligibility.NotListed)
    expect(nodeVoteEligibility(orbit, vote(orbit.proTxHash, LOCK, 5), FOR_A, contest, NOW)).toBe(NodeVoteEligibility.NoVotesLeft)
    expect(nodeVoteEligibility(orbit, vote(orbit.proTxHash, LOCK, 2), LOCK, contest, NOW)).toBe(NodeVoteEligibility.SameChoice)
  })

  it('reports an ended contest before anything else', () => {
    expect(nodeVoteEligibility(node('w', { access: MasternodeAccess.WatchOnly }), null, LOCK, { ...contest, status: ContestStatus.Awarded }, NOW))
      .toBe(NodeVoteEligibility.Ended)
    expect(nodeVoteEligibility(orbit, null, LOCK, contest, contest.endsAt)).toBe(NodeVoteEligibility.Ended)
  })

  it('lets a node change its vote to another contender or vote before a choice is made', () => {
    expect(nodeVoteEligibility(orbit, vote(orbit.proTxHash, FOR_A, 4), FOR_B, contest, NOW)).toBe(NodeVoteEligibility.Eligible)
    expect(nodeVoteEligibility(orbit, vote(orbit.proTxHash, FOR_A, 1), null, contest, NOW)).toBe(NodeVoteEligibility.Eligible)
  })
})

describe('toggledSet', () => {
  it('adds or removes one value without touching the original', () => {
    const original: ReadonlySet<string> = new Set(['orbit'])
    expect([...toggledSet(original, 'lumen', true)]).toEqual(['orbit', 'lumen'])
    expect([...toggledSet(original, 'orbit', false)]).toEqual([])
    expect([...toggledSet(original, 'orbit', true)]).toEqual(['orbit'])
    expect([...toggledSet(original, 'vega', false)]).toEqual(['orbit'])
    expect([...original]).toEqual(['orbit'])
  })
})

describe('voteChoiceEquals', () => {
  it('compares contenders by identifier and other choices by kind', () => {
    expect(voteChoiceEquals(FOR_A, { ...FOR_A })).toBe(true)
    expect(voteChoiceEquals(FOR_A, FOR_B)).toBe(false)
    expect(voteChoiceEquals(LOCK, { kind: VoteChoiceKind.Lock, identifier: null })).toBe(true)
    expect(voteChoiceEquals(LOCK, { kind: VoteChoiceKind.Abstain, identifier: null })).toBe(false)
  })
})

describe('applyVoteResults', () => {
  it('records successful nodes only, adding first votes and counting changes', () => {
    const votes = [vote('orbit', FOR_A, 4), vote('lumen', FOR_A, 1), vote('orbit', LOCK, 2, 'other')]
    const results = [
      { proTxHash: 'orbit', ok: true, error: null },
      { proTxHash: 'lumen', ok: false, error: 'Vote not accepted by the network — try again' },
      { proTxHash: 'vega', ok: true, error: null },
    ]
    expect(applyVoteResults(votes, results, 'a11ce', FOR_B, 99)).toEqual([
      { proTxHash: 'orbit', normalizedLabel: 'a11ce', choice: FOR_B, votesUsed: 5, castAt: 99 },
      vote('lumen', FOR_A, 1),
      vote('orbit', LOCK, 2, 'other'),
      { proTxHash: 'vega', normalizedLabel: 'a11ce', choice: FOR_B, votesUsed: 1, castAt: 99 },
    ])
  })
})
