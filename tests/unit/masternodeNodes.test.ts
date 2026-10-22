import { describe, expect, it } from 'vitest'
import {
  addedVotingPower,
  countLabel,
  formatBlockHeight,
  isNodeAlreadyAdded,
  nodeSegmentOptions,
  nodeVotes,
  nodeWeightLabel,
  votingPowerBreakdown,
} from '../../src/renderer/src/utils/masternodeNodes'
import { COUNT_NOUNS } from '../../src/renderer/src/constants/masternodeNodes'
import {
  AddNodeSource,
  MasternodeAccess,
  MasternodeStatus,
  MasternodeType,
  NodeSegment,
  VoteChoiceKind,
} from '../../src/renderer/src/enums/Masternodes'
import type { MasternodeDto, MasternodeVoteDto } from '../../src/renderer/src/types/Masternodes'

function node(label: string, overrides: Partial<MasternodeDto> = {}): MasternodeDto {
  return {
    proTxHash: label.toLowerCase().padEnd(64, 'f'),
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

function vote(proTxHash: string, normalizedLabel: string, castAt: number): MasternodeVoteDto {
  return { proTxHash, normalizedLabel, choice: { kind: VoteChoiceKind.Lock, identifier: null }, votesUsed: 1, castAt }
}

describe('countLabel', () => {
  it('uses the singular only for one', () => {
    expect(countLabel(1, COUNT_NOUNS.node)).toBe('1 node')
    expect(countLabel(0, COUNT_NOUNS.node)).toBe('0 nodes')
    expect(countLabel(24, COUNT_NOUNS.node)).toBe('24 nodes')
  })
})

describe('nodeSegmentOptions', () => {
  it('labels every segment with its count in enum order', () => {
    const options = nodeSegmentOptions({
      [NodeSegment.All]: 24,
      [NodeSegment.CanVote]: 17,
      [NodeSegment.WatchOnly]: 4,
      [NodeSegment.Issues]: 3,
    })
    expect(options).toEqual([
      { value: NodeSegment.All, label: 'All · 24' },
      { value: NodeSegment.CanVote, label: 'Can vote · 17' },
      { value: NodeSegment.WatchOnly, label: 'Watch-only · 4' },
      { value: NodeSegment.Issues, label: 'Issues · 3' },
    ])
  })
})

describe('nodeWeightLabel', () => {
  it('shows the weight for voting nodes, banned or not', () => {
    expect(nodeWeightLabel(node('Evo', { type: MasternodeType.Evo }))).toBe('×4')
    expect(nodeWeightLabel(node('Orbit', { status: MasternodeStatus.PoseBanned }))).toBe('×1')
  })

  it('shows a dash for watch-only nodes', () => {
    expect(nodeWeightLabel(node('Sentinel', { access: MasternodeAccess.WatchOnly, type: MasternodeType.Evo }))).toBe('—')
  })
})

describe('votingPowerBreakdown', () => {
  it('lists evonodes before masternodes and skips empty parts', () => {
    expect(votingPowerBreakdown({ votes: 32, evonodes: 5, masternodes: 12 })).toBe('5 evonodes ×4 · 12 masternodes ×1')
    expect(votingPowerBreakdown({ votes: 1, evonodes: 0, masternodes: 1 })).toBe('1 masternode ×1')
    expect(votingPowerBreakdown({ votes: 4, evonodes: 1, masternodes: 0 })).toBe('1 evonode ×4')
    expect(votingPowerBreakdown({ votes: 0, evonodes: 0, masternodes: 0 })).toBe('')
  })
})

describe('isNodeAlreadyAdded', () => {
  const voting = node('Atlas')
  const watched = node('Sentinel', { access: MasternodeAccess.WatchOnly })
  const nodes = [voting, watched]

  it('treats any existing node as added for watch only', () => {
    expect(isNodeAlreadyAdded(voting, nodes, AddNodeSource.WatchOnly)).toBe(true)
    expect(isNodeAlreadyAdded(watched, nodes, AddNodeSource.WatchOnly)).toBe(true)
  })

  it('lets a voting key upgrade a watch-only node', () => {
    expect(isNodeAlreadyAdded(voting, nodes, AddNodeSource.VotingKey)).toBe(true)
    expect(isNodeAlreadyAdded(watched, nodes, AddNodeSource.VotingKey)).toBe(false)
  })

  it('is false for unknown nodes', () => {
    expect(isNodeAlreadyAdded(node('Rigel'), nodes, AddNodeSource.VotingKey)).toBe(false)
    expect(isNodeAlreadyAdded(node('Rigel'), nodes, AddNodeSource.WatchOnly)).toBe(false)
  })
})

describe('addedVotingPower', () => {
  it('sums the weight of selected active nodes only', () => {
    const evo = node('Polaris', { type: MasternodeType.Evo })
    const regular = node('Meridian')
    const banned = node('Rigel', { status: MasternodeStatus.PoseBanned })
    const candidates = [evo, regular, banned]
    expect(addedVotingPower(candidates, new Set([evo.proTxHash, regular.proTxHash, banned.proTxHash]))).toBe(5)
    expect(addedVotingPower(candidates, new Set([regular.proTxHash]))).toBe(1)
    expect(addedVotingPower(candidates, new Set())).toBe(0)
  })
})

describe('formatBlockHeight', () => {
  it('groups thousands behind a hash', () => {
    expect(formatBlockHeight(1_902_331)).toBe('#1,902,331')
    expect(formatBlockHeight(12)).toBe('#12')
  })
})

describe('nodeVotes', () => {
  it('keeps the node’s votes, newest first', () => {
    const votes = [vote('a', 'alice', 10), vote('b', 'bob', 30), vote('a', 'dash', 20)]
    expect(nodeVotes(votes, 'a').map(item => item.normalizedLabel)).toEqual(['dash', 'alice'])
    expect(nodeVotes(votes, 'c')).toEqual([])
  })

  it('does not reorder the input', () => {
    const votes = [vote('a', 'alice', 10), vote('a', 'dash', 20)]
    nodeVotes(votes, 'a')
    expect(votes.map(item => item.normalizedLabel)).toEqual(['alice', 'dash'])
  })
})
