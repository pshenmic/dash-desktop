import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Network } from '../../src/renderer/src/api/types'
import { PREVIEW_BACKEND_ERRORS } from '../../src/renderer/src/constants/masternodePreview'
import { MASTERNODE_VOTE_WEIGHT, NODE_ELIGIBILITY_LABELS } from '../../src/renderer/src/constants/masternodes'
import {
  ContestSegment,
  ContestStatus,
  MasternodeAccess,
  MasternodePreviewPreset,
  NodeSegment,
  NodeVoteEligibility,
  VoteChoiceKind,
} from '../../src/renderer/src/enums/Masternodes'
import type { ContestContenderDto, MasternodeDto, NameContestDto, VoteChoiceDto } from '../../src/renderer/src/types/Masternodes'
import type { PreviewIdentity, PreviewWalletState } from '../../src/renderer/src/types/Preview'
import {
  addPreviewNodes,
  buildPreviewWallet,
  castPreviewVotes,
  findPreviewNode,
  findPreviewNodesByVotingKey,
  previewStem,
  removePreviewNode,
  seededRandom,
  settleExpiredContests,
} from '../../src/renderer/src/utils/masternodePreview'
import { countNodeSegments, votesLeft, votingPower } from '../../src/renderer/src/utils/masternodes'
import { contestVoteSummary, countContestSegments, isEndingSoon } from '../../src/renderer/src/utils/nameContests'

const NOW = Date.UTC(2026, 9, 22, 12)
const WALLET = '338e9f47'
const IDENTITIES: PreviewIdentity[] = [
  { identifier: '8eTDk'.padEnd(44, 'b'), identityIndex: 1, usernames: ['canuseethat1.dash'] },
  { identifier: 'B7kcE'.padEnd(44, 'a'), identityIndex: 0, usernames: ['owl11.dash', 'owl.dash'] },
  { identifier: '7cBLv'.padEnd(44, 'c'), identityIndex: 2, usernames: [] },
]
const [SECOND, FIRST] = IDENTITIES
const TESTNET_WIF = `c${'N'.repeat(50)}`
const ABSTAIN: VoteChoiceDto = { kind: VoteChoiceKind.Abstain, identifier: null }
const LOCK: VoteChoiceDto = { kind: VoteChoiceKind.Lock, identifier: null }

function wallet(preset = MasternodePreviewPreset.Operator, network: Network = 'testnet'): PreviewWalletState {
  return buildPreviewWallet({ walletId: WALLET, network, now: NOW, preset, identities: IDENTITIES })
}

function node(state: PreviewWalletState, label: string): MasternodeDto {
  const found = state.nodes.find(candidate => candidate.label === label)
  if (found == null) throw new Error(`missing node ${label}`)
  return found
}

function contest(state: PreviewWalletState, label: string): NameContestDto {
  const found = state.contests.find(candidate => candidate.label === label)
  if (found == null) throw new Error(`missing contest ${label}`)
  return found
}

function contestContext(state: PreviewWalletState, network: Network = 'testnet') {
  return {
    nodes: state.nodes,
    votes: state.votes,
    walletIdentifiers: new Set(IDENTITIES.map(identity => identity.identifier)),
    now: NOW,
    network,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    const first = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(first)
    expect(first.every(value => value >= 0 && value < 1)).toBe(true)
  })
})

describe('buildPreviewWallet', () => {
  it('is deterministic for a wallet and reads no clock of its own', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('clock read')
    })
    expect(wallet()).toEqual(wallet())
    expect(wallet().seededAt).toBe(NOW)
  })

  it.each([
    [MasternodePreviewPreset.None, 0],
    [MasternodePreviewPreset.Operator, 24],
    [MasternodePreviewPreset.Large, 120],
  ])('seeds %s with %i distinct nodes', (preset, count) => {
    const { nodes } = wallet(preset)
    expect(nodes).toHaveLength(count)
    expect(new Set(nodes.map(entry => entry.proTxHash)).size).toBe(count)
    expect(new Set(nodes.map(entry => entry.label)).size).toBe(count)
    expect(nodes.every(entry => /^[0-9a-f]{64}$/.test(entry.proTxHash))).toBe(true)
  })

  it('gives the Operator preset 17 voting nodes worth 32 votes, 4 watch-only and 3 with issues', () => {
    const { nodes } = wallet()
    expect(countNodeSegments(nodes, '')).toEqual({
      [NodeSegment.All]: 24,
      [NodeSegment.CanVote]: 17,
      [NodeSegment.WatchOnly]: 4,
      [NodeSegment.Issues]: 3,
    })
    expect(votingPower(nodes)).toEqual({ votes: 32, evonodes: 5, masternodes: 12 })
  })

  it('flags only Vega to fail its next vote', () => {
    const state = wallet()
    expect(state.failNextVote).toEqual([node(state, 'Vega').proTxHash])
    expect(wallet(MasternodePreviewPreset.Large).failNextVote).toEqual([node(wallet(MasternodePreviewPreset.Large), 'Vega').proTxHash])
    expect(wallet(MasternodePreviewPreset.None).failNextVote).toEqual([])
  })

  it.each<Network>(['testnet', 'mainnet'])('builds 120 contests with the planned mix on %s', (network) => {
    const { contests } = wallet(MasternodePreviewPreset.Operator, network)
    const open = contests.filter(entry => entry.status === ContestStatus.Open)
    const count = (status: ContestStatus): number => contests.filter(entry => entry.status === status).length
    expect(contests).toHaveLength(120)
    expect(new Set(contests.map(entry => entry.normalizedLabel)).size).toBe(120)
    expect(open).toHaveLength(38)
    expect(open.filter(entry => isEndingSoon(entry, NOW, network))).toHaveLength(5)
    expect(open.filter(entry => NOW < entry.joinClosesAt)).toHaveLength(3)
    expect(open.every(entry => entry.startedAt < NOW && NOW < entry.endsAt)).toBe(true)
    expect([count(ContestStatus.Awarded), count(ContestStatus.Locked), count(ContestStatus.NoWinner)]).toEqual([64, 12, 6])
    expect(contests.filter(entry => entry.status !== ContestStatus.Open).every(entry => entry.endsAt < NOW)).toBe(true)
  })

  it('settles every awarded contest on a strict winner and every locked one on lock', () => {
    const { contests } = wallet()
    for (const entry of contests.filter(candidate => candidate.status === ContestStatus.Awarded)) {
      const winner = entry.contenders.find(contender => contender.identifier === entry.winnerId)
      expect(winner).toBeDefined()
      const rivals = entry.contenders.filter(contender => contender !== winner).map(contender => contender.votes)
      expect(winner!.votes).toBeGreaterThan(Math.max(entry.votesLock, ...rivals))
    }
    for (const entry of contests.filter(candidate => candidate.status === ContestStatus.Locked)) {
      expect(entry.votesLock).toBeGreaterThan(Math.max(0, ...entry.contenders.map(contender => contender.votes)))
      expect(entry.winnerId).toBeNull()
    }
  })

  it('leaves every no-winner contest without contenders or lock votes', () => {
    const noWinner = wallet().contests.filter(candidate => candidate.status === ContestStatus.NoWinner)
    expect(noWinner).toHaveLength(6)
    expect(noWinner.every(entry => entry.contenders.length === 0 && entry.votesLock === 0 && entry.winnerId === null)).toBe(true)
  })

  it('places the wallet identities in the named contests', () => {
    const state = wallet()
    const pay = contest(state, 'owl11-pay')
    expect(pay.status).toBe(ContestStatus.Open)
    expect(pay.normalizedLabel).toBe('0w111-pay')
    expect(pay.contenders).toHaveLength(2)
    expect(pay.contenders[0]).toMatchObject({ identifier: FIRST.identifier, displayName: 'owl11.dash', votes: 12 })
    expect(pay.endsAt - NOW).toBe(Math.round(0.6 * 5_400_000))

    const nova = contest(state, 'nova')
    expect(nova.status).toBe(ContestStatus.Awarded)
    expect(nova.contenders.find(contender => contender.identifier === SECOND.identifier)?.votes).toBe(4)
    expect(nova.winnerId).not.toBe(SECOND.identifier)

    const vault = contest(state, 'vault')
    expect(vault.status).toBe(ContestStatus.Locked)
    expect(vault.contenders.map(contender => contender.identifier)).toEqual([SECOND.identifier])
    expect(vault.votesLock).toBe(9)

    expect(contest(state, 'kai')).toMatchObject({ status: ContestStatus.NoWinner, contenders: [] })
    expect(contest(state, 'dash').contenders).toHaveLength(16)
  })

  it('falls back to fixture contenders and a stock stem without wallet identities', () => {
    const state = buildPreviewWallet({ walletId: WALLET, network: 'testnet', now: NOW, preset: MasternodePreviewPreset.Operator, identities: [] })
    expect(previewStem([])).toBe('alice')
    expect(contest(state, 'alice-pay').contenders[0].votes).toBe(12)
    expect(state.contests).toHaveLength(120)
  })

  it('records our votes: 4 used by Orbit, 5 by Lumen, 7 open contests voted by eligible nodes, 2 of them mixed', () => {
    const state = wallet()
    const orbit = state.votes.find(vote => vote.proTxHash === node(state, 'Orbit').proTxHash && vote.normalizedLabel === '0w111-pay')
    const lumen = state.votes.find(vote => vote.proTxHash === node(state, 'Lumen').proTxHash && vote.normalizedLabel === 'dash')
    expect(orbit?.votesUsed).toBe(4)
    expect(votesLeft(orbit ?? null)).toBe(1)
    expect(lumen?.votesUsed).toBe(5)
    expect(votesLeft(lumen ?? null)).toBe(0)

    const counts = countContestSegments(state.contests, { query: '', yourNamesOnly: false }, contestContext(state))
    expect(counts.segments[ContestSegment.NotVoted]).toBe(31)
    expect(counts.yourNames).toBe(3)

    const open = state.contests.filter(entry => entry.status === ContestStatus.Open)
    expect(open.filter(entry => contestVoteSummary(entry, state.votes).mixed)).toHaveLength(2)
    const ended = state.contests.filter(entry => entry.status !== ContestStatus.Open)
    expect(ended.filter(entry => contestVoteSummary(entry, state.votes).nodes > 0)).toHaveLength(4)
  })

  it('keeps 31 not-voted contests on the Large preset and none voted without nodes', () => {
    const large = wallet(MasternodePreviewPreset.Large)
    expect(countContestSegments(large.contests, { query: '', yourNamesOnly: false }, contestContext(large)).segments[ContestSegment.NotVoted]).toBe(31)
    const empty = wallet(MasternodePreviewPreset.None)
    expect(empty.votes).toEqual([])
    expect(countContestSegments(empty.contests, { query: '', yourNamesOnly: false }, contestContext(empty)).segments[ContestSegment.NotVoted]).toBe(38)
  })
})

describe('findPreviewNodesByVotingKey', () => {
  it('matches the same three unadded nodes for any valid key of the network', () => {
    const state = wallet()
    const found = findPreviewNodesByVotingKey(state, TESTNET_WIF)
    expect(found.map(entry => entry.label)).toEqual(['Meridian', 'Polaris', 'Rigel'])
    expect(findPreviewNodesByVotingKey(state, `  c${'P'.repeat(50)} `)).toEqual(found)
    expect(found.some(entry => state.nodes.some(existing => existing.proTxHash === entry.proTxHash))).toBe(false)
  })

  it('matches nothing for a key ending in 1, a key of the other network or an invalid key', () => {
    const state = wallet()
    expect(findPreviewNodesByVotingKey(state, `c${'N'.repeat(49)}1`)).toEqual([])
    expect(findPreviewNodesByVotingKey(state, `7${'N'.repeat(50)}`)).toEqual([])
    expect(findPreviewNodesByVotingKey(state, 'not a key')).toEqual([])
    expect(findPreviewNodesByVotingKey(state, `c${'N'.repeat(49)}1`, node(state, 'Sentinel').proTxHash)).toEqual([])
  })

  it('also matches the expected wallet node, first and once, so it can be upgraded', () => {
    const state = wallet()
    const sentinel = node(state, 'Sentinel')
    const found = findPreviewNodesByVotingKey(state, TESTNET_WIF, sentinel.proTxHash)
    expect(found.map(entry => entry.label)).toEqual(['Sentinel', 'Meridian', 'Polaris', 'Rigel'])
    expect(found[0]).toBe(sentinel)
    expect(findPreviewNodesByVotingKey(state, TESTNET_WIF, 'ab'.repeat(32))).toEqual(findPreviewNodesByVotingKey(state, TESTNET_WIF))

    const upgraded = addPreviewNodes(state, [sentinel.proTxHash], true, NOW)
    expect(node(upgraded, 'Sentinel').access).toBe(MasternodeAccess.VotingKey)
    expect(upgraded.nodes).toHaveLength(24)

    const [meridian] = findPreviewNodesByVotingKey(state, TESTNET_WIF)
    const watched = addPreviewNodes(state, [meridian.proTxHash], false, NOW)
    expect(findPreviewNodesByVotingKey(watched, TESTNET_WIF, meridian.proTxHash).map(entry => entry.label)).toEqual(['Meridian', 'Polaris', 'Rigel'])
  })
})

describe('settleExpiredContests', () => {
  const ENDED = NOW - 1
  const open = (overrides: Partial<NameContestDto>): NameContestDto => ({
    normalizedLabel: 'a11ce',
    label: 'alice',
    status: ContestStatus.Open,
    contenders: [],
    votesLock: 0,
    votesAbstain: 0,
    startedAt: ENDED - 5_400_000,
    joinClosesAt: ENDED - 2_700_000,
    endsAt: ENDED,
    winnerId: null,
    ...overrides,
  })
  const contender = (identifier: string, votes: number, requestedAt = 0): ContestContenderDto => (
    { identifier, displayName: null, requestedLabel: 'alice', votes, requestedAt }
  )

  it('awards an expired contest to its top contender and keeps the tallies', () => {
    const expired = open({ contenders: [contender('A', 3), contender('B', 7)], votesLock: 2, votesAbstain: 4 })
    const [settled] = settleExpiredContests([expired], NOW)
    expect(settled).toEqual({ ...expired, status: ContestStatus.Awarded, winnerId: 'B' })
  })

  it('locks only when lock votes strictly exceed the top contender', () => {
    const [locked, tied] = settleExpiredContests([
      open({ contenders: [contender('A', 5)], votesLock: 6 }),
      open({ contenders: [contender('A', 5)], votesLock: 5 }),
    ], NOW)
    expect(locked).toMatchObject({ status: ContestStatus.Locked, winnerId: null })
    expect(tied).toMatchObject({ status: ContestStatus.Awarded, winnerId: 'A' })
  })

  it('breaks a contender tie for the earliest request and ends without contenders on no winner', () => {
    const [tie, empty, silent] = settleExpiredContests([
      open({ contenders: [contender('late', 4, 20), contender('early', 4, 10)] }),
      open({ votesLock: 3 }),
      open({ contenders: [contender('A', 0)] }),
    ], NOW)
    expect(tie).toMatchObject({ status: ContestStatus.Awarded, winnerId: 'early' })
    expect(empty).toMatchObject({ status: ContestStatus.NoWinner, winnerId: null })
    expect(silent).toMatchObject({ status: ContestStatus.Awarded, winnerId: 'A' })
  })

  it('leaves running and already settled contests untouched', () => {
    const running = open({ contenders: [contender('A', 1)], endsAt: NOW + 1 })
    const awarded = open({ status: ContestStatus.Awarded, contenders: [contender('A', 1)], winnerId: 'A' })
    const settled = settleExpiredContests([running, awarded], NOW)
    expect(settled[0]).toBe(running)
    expect(settled[1]).toBe(awarded)
  })

  it('moves the expired preview contests from Open to Ended', () => {
    const state = wallet()
    const pay = contest(state, 'owl11-pay')
    const stillOpen = state.contests.filter(entry => entry.status === ContestStatus.Open && entry.endsAt > pay.endsAt)
    const later = settleExpiredContests(state.contests, pay.endsAt)
    const counts = countContestSegments(later, { query: '', yourNamesOnly: false }, { ...contestContext(state), now: pay.endsAt })
    expect(later.find(entry => entry.label === 'owl11-pay')?.status).not.toBe(ContestStatus.Open)
    expect(stillOpen.length).toBeGreaterThan(0)
    expect(counts.segments[ContestSegment.Open]).toBe(stillOpen.length)
    expect(counts.segments[ContestSegment.Ended]).toBe(state.contests.length - stillOpen.length)
  })
})

describe('findPreviewNode', () => {
  it('returns a listed node, a key candidate or a new watch-only node, and nothing for a hash ending in 0', () => {
    const state = wallet()
    const sentinel = node(state, 'Sentinel')
    const [meridian] = findPreviewNodesByVotingKey(state, TESTNET_WIF)
    expect(findPreviewNode(state, sentinel.proTxHash.toUpperCase())).toEqual(sentinel)
    expect(findPreviewNode(state, meridian.proTxHash)).toEqual(meridian)
    const watched = findPreviewNode(state, 'ab'.repeat(32))
    expect(watched).toMatchObject({ proTxHash: 'ab'.repeat(32), label: 'Node', access: MasternodeAccess.WatchOnly })
    expect(findPreviewNode(state, `${'ab'.repeat(31)}a0`)).toBeNull()
    expect(findPreviewNode(state, 'xyz')).toBeNull()
  })
})

describe('addPreviewNodes and removePreviewNode', () => {
  it('adds key nodes with their access, upgrades a watch-only node and never adds a node twice', () => {
    const state = wallet()
    const keyNodes = findPreviewNodesByVotingKey(state, TESTNET_WIF).map(entry => entry.proTxHash)
    const sentinel = node(state, 'Sentinel').proTxHash
    const next = addPreviewNodes(state, [...keyNodes, sentinel, keyNodes[0]], true, NOW + 1)
    expect(next.nodes).toHaveLength(27)
    expect(next.nodes.slice(24).every(entry => entry.access === MasternodeAccess.VotingKey && entry.addedAt === NOW + 1)).toBe(true)
    expect(node(next, 'Sentinel').access).toBe(MasternodeAccess.VotingKey)

    const watched = addPreviewNodes(state, ['cd'.repeat(32)], false, NOW)
    expect(watched.nodes.at(-1)).toMatchObject({ proTxHash: 'cd'.repeat(32), access: MasternodeAccess.WatchOnly })
    expect(node(watched, 'Sentinel').access).toBe(MasternodeAccess.WatchOnly)
  })

  it('removes a node with its votes', () => {
    const state = wallet()
    const orbit = node(state, 'Orbit').proTxHash
    const next = removePreviewNode(state, orbit)
    expect(next.nodes).toHaveLength(23)
    expect(next.votes.some(vote => vote.proTxHash === orbit)).toBe(false)
  })
})

describe('castPreviewVotes', () => {
  it('records eligible nodes only, fails Vega once and moves the tallies by node weight', () => {
    const state = wallet()
    const before = contest(state, 'dash')
    const hashes = ['Northstar', 'Lumen', 'Vega', 'Sentinel'].map(label => node(state, label).proTxHash)
    const first = castPreviewVotes(state, 'dash', ABSTAIN, hashes, NOW)!
    expect(first.result).toEqual([
      { proTxHash: hashes[0], ok: true, error: null },
      { proTxHash: hashes[1], ok: false, error: NODE_ELIGIBILITY_LABELS[NodeVoteEligibility.NoVotesLeft] },
      { proTxHash: hashes[2], ok: false, error: PREVIEW_BACKEND_ERRORS.voteRejected },
      { proTxHash: hashes[3], ok: false, error: NODE_ELIGIBILITY_LABELS[NodeVoteEligibility.NoKey] },
    ])
    expect(contest(first.state, 'dash').votesAbstain).toBe(before.votesAbstain + 4)
    expect(first.state.failNextVote).toEqual([])

    const retry = castPreviewVotes(first.state, 'dash', ABSTAIN, [hashes[2]], NOW)!
    expect(retry.result).toEqual([{ proTxHash: hashes[2], ok: true, error: null }])
    expect(contest(retry.state, 'dash').votesAbstain).toBe(before.votesAbstain + 5)
    expect(retry.state.votes.find(vote => vote.proTxHash === hashes[2] && vote.normalizedLabel === 'dash'))
      .toMatchObject({ choice: ABSTAIN, votesUsed: 1, castAt: NOW })
  })

  it('withdraws a changed vote from its previous choice', () => {
    const state = wallet()
    const previous = state.votes.find(vote => vote.normalizedLabel === 'dash' && vote.choice.kind === VoteChoiceKind.TowardsIdentity
      && state.nodes.find(entry => entry.proTxHash === vote.proTxHash)?.label !== 'Lumen')!
    const voter = state.nodes.find(entry => entry.proTxHash === previous.proTxHash)!
    const weight = MASTERNODE_VOTE_WEIGHT[voter.type]
    const before = contest(state, 'dash')
    const backed = (entry: NameContestDto): number => entry.contenders.find(contender => contender.identifier === previous.choice.identifier)!.votes

    const outcome = castPreviewVotes(state, 'dash', LOCK, [voter.proTxHash], NOW)!
    const after = contest(outcome.state, 'dash')
    expect(after.votesLock).toBe(before.votesLock + weight)
    expect(backed(after)).toBe(backed(before) - weight)
    expect(outcome.state.votes.find(vote => vote.proTxHash === voter.proTxHash && vote.normalizedLabel === 'dash')?.votesUsed).toBe(2)
  })

  it('returns nothing for an unknown contest', () => {
    expect(castPreviewVotes(wallet(), 'missing', LOCK, [], NOW)).toBeNull()
  })
})
