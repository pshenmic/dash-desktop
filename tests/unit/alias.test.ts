import {describe, it, expect} from 'vitest'
import {aliasStatusOf, scheduledVoteEnd} from '../../src/main/src/utils/alias'
import {AliasVote} from '../../src/main/src/types/Alias'

const OURS = 'ours'
const THEIRS = 'theirs'

function vote(overrides: Partial<AliasVote>): AliasVote {
  return {contenders: [], lockVotes: 0, abstainVotes: 0, outcome: null, winner: null, endsAt: null, ...overrides}
}

describe('aliasStatusOf', () => {
  it('reads a domain document owned by the identity as registered', () => {
    expect(aliasStatusOf(OURS, OURS, null)).toBe('registered')
  })

  it('reads a domain document owned by another identity as taken', () => {
    expect(aliasStatusOf(OURS, THEIRS, null)).toBe('taken')
  })

  it('lets the domain document win over a stale contest', () => {
    expect(aliasStatusOf(OURS, OURS, vote({outcome: 'Locked'}))).toBe('registered')
  })

  it('reads no document and no contest as missing', () => {
    expect(aliasStatusOf(OURS, null, null)).toBe('missing')
  })

  it('reads a running contest the identity entered as voting', () => {
    const running = vote({contenders: [{identifier: THEIRS, votes: 3}, {identifier: OURS, votes: 1}]})
    expect(aliasStatusOf(OURS, null, running)).toBe('voting')
  })

  it('reads a running contest the identity is not in as missing', () => {
    expect(aliasStatusOf(OURS, null, vote({contenders: [{identifier: THEIRS, votes: 0}]}))).toBe('missing')
  })

  it('reads a contest won by the identity as registered before its document lands', () => {
    expect(aliasStatusOf(OURS, null, vote({outcome: 'WonByIdentity', winner: OURS}))).toBe('registered')
  })

  it('reads a contest won by another identity as taken', () => {
    expect(aliasStatusOf(OURS, null, vote({outcome: 'WonByIdentity', winner: THEIRS}))).toBe('taken')
  })

  it('reads a locked contest as locked', () => {
    expect(aliasStatusOf(OURS, null, vote({outcome: 'Locked'}))).toBe('locked')
  })

  it('reads a contest that ended without a winner as missing', () => {
    expect(aliasStatusOf(OURS, null, vote({outcome: 'NoWinner'}))).toBe('missing')
  })
})

describe('scheduledVoteEnd', () => {
  it('counts the duration from the earliest contender', () => {
    expect(scheduledVoteEnd([3_000, 1_000, 2_000], 500)).toBe(1_500)
  })

  it('has no end without a dated contender', () => {
    expect(scheduledVoteEnd([], 500)).toBeNull()
  })
})
