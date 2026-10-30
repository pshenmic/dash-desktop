import { describe, expect, it } from 'vitest'
import {
  usernamePresentation,
  contestStandings,
  joinClosesAt,
  mergeIdentityUsernames,
  usernameAvailability,
  usernameCaption,
  usernameOrder,
  voteOutcomeLabel,
  voteTiming,
} from '../../src/renderer/src/utils/usernames'
import { normalizeDpnsLabel } from '../../src/renderer/src/utils/dpnsLabel'
import { UsernamePresentation, UsernameStatus, UsernameAvailability, UsernameVoteOutcome } from '../../src/renderer/src/enums/DashPay'
import { USERNAME_PRESENTATION } from '../../src/renderer/src/constants/dpns'
import type { UsernameDto } from '../../src/renderer/src/api/types'
import type { UsernameAvailabilityInput } from '../../src/renderer/src/types/Dpns'

const ME = 'MyIdentity'
const NOW = new Date(2026, 9, 22, 12).getTime()

function username(label: string, status: UsernameStatus, overrides: Partial<UsernameDto> = {}): UsernameDto {
  return {
    identifier: ME,
    label,
    normalizedLabel: normalizeDpnsLabel(label),
    isContested: false,
    status,
    documentId: null,
    votesLock: null,
    votesAbstain: null,
    voteEndsAt: null,
    voteOutcome: null,
    voteWinner: null,
    contenders: [],
    ...overrides,
  }
}

describe('usernamePresentation', () => {
  it('maps every status', () => {
    expect(usernamePresentation(username('a', UsernameStatus.Registered))).toBe(UsernamePresentation.Registered)
    expect(usernamePresentation(username('a', UsernameStatus.Voting))).toBe(UsernamePresentation.Voting)
    expect(usernamePresentation(username('a', UsernameStatus.Locked))).toBe(UsernamePresentation.Locked)
    expect(usernamePresentation(username('a', UsernameStatus.Taken))).toBe(UsernamePresentation.Taken)
    expect(usernamePresentation(username('a', UsernameStatus.Missing))).toBe(UsernamePresentation.Missing)
  })
})

describe('mergeIdentityUsernames', () => {
  const entries = [
    username('bbbbbbbasa', UsernameStatus.Registered),
    username('bbbbbbbasa-pay', UsernameStatus.Voting, { isContested: true, voteEndsAt: NOW }),
    username('kai', UsernameStatus.Missing, { isContested: true }),
    username('nova', UsernameStatus.Taken, { isContested: true }),
    username('vault', UsernameStatus.Locked, { isContested: true }),
    username('other', UsernameStatus.Registered, { identifier: 'OtherIdentity' }),
  ]
  const rows = mergeIdentityUsernames(['bbbbbbbasa.dash', 'Bbbbbbbasa2.dash'], entries, ME)

  it('keeps this identity’s rows and orders actionable names first', () => {
    expect(rows.map(row => [row.label, row.presentation])).toEqual([
      ['bbbbbbbasa-pay', UsernamePresentation.Voting],
      ['bbbbbbbasa', UsernamePresentation.Registered],
      ['Bbbbbbbasa2', UsernamePresentation.Registered],
      ['nova', UsernamePresentation.Taken],
      ['vault', UsernamePresentation.Locked],
      ['kai', UsernamePresentation.Missing],
    ])
  })

  it('synthesizes a registered row for an owned name without a row', () => {
    expect(rows.find(row => row.label === 'Bbbbbbbasa2')).toEqual({
      label: 'Bbbbbbbasa2',
      normalizedLabel: 'bbbbbbbasa2',
      fullName: 'Bbbbbbbasa2.dash',
      presentation: UsernamePresentation.Registered,
      isContested: false,
      isPrimary: false,
      username: null,
    })
  })

  it('marks the oldest owned name as primary', () => {
    expect(rows.filter(row => row.isPrimary).map(row => row.label)).toEqual(['bbbbbbbasa'])
  })

  it('dedupes an owned name against its row by the normalized label', () => {
    const merged = mergeIdentityUsernames(['A1ice.dash'], [username('Alice', UsernameStatus.Registered)], ME)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ label: 'Alice', isPrimary: true })
  })
})

describe('usernameOrder', () => {
  it('sorts names with the same status by name', () => {
    const merged = mergeIdentityUsernames([], [
      username('beta', UsernameStatus.Registered),
      username('alpha', UsernameStatus.Registered),
    ], ME)
    expect(merged.map(row => row.label)).toEqual(['alpha', 'beta'])
    expect(usernameOrder(merged[0], merged[1])).toBeLessThan(0)
  })
})

describe('usernameAvailability', () => {
  const base: UsernameAvailabilityInput = {
    normalized: 'a11ce',
    identifier: ME,
    walletIdentifiers: new Set([ME]),
    walletUsernames: [],
    results: [{ identifier: 'OtherIdentity', name: 'A1ice.dash' }],
    loading: false,
    error: null,
  }

  it('reports idle, error and checking before looking at results', () => {
    expect(usernameAvailability({ ...base, normalized: '' })).toBe(UsernameAvailability.Idle)
    expect(usernameAvailability({ ...base, loading: true, error: 'offline' })).toBe(UsernameAvailability.Error)
    expect(usernameAvailability({ ...base, loading: true })).toBe(UsernameAvailability.Checking)
    expect(usernameAvailability({ ...base, results: null })).toBe(UsernameAvailability.Checking)
  })

  it('matches a homograph spelling and tells who owns it', () => {
    expect(usernameAvailability(base)).toBe(UsernameAvailability.Taken)
    expect(usernameAvailability({ ...base, results: [{ identifier: ME, name: 'Alice.dash' }] })).toBe(UsernameAvailability.Owned)
    expect(usernameAvailability({ ...base, walletIdentifiers: new Set([ME, 'OtherIdentity']) })).toBe(UsernameAvailability.OwnedByWallet)
  })

  it('knows the wallet’s own claims on a name before search can see them', () => {
    const contest = username('alice', UsernameStatus.Voting, { isContested: true })
    const nameless = { ...base, results: [] }
    expect(usernameAvailability({ ...nameless, walletUsernames: [contest] })).toBe(UsernameAvailability.InContest)
    expect(usernameAvailability({ ...nameless, walletUsernames: [{ ...contest, identifier: 'Sibling' }] })).toBe(UsernameAvailability.InWalletContest)
    expect(usernameAvailability({ ...nameless, walletUsernames: [username('alice', UsernameStatus.Registered)] })).toBe(UsernameAvailability.Owned)
    expect(usernameAvailability({ ...nameless, walletUsernames: [username('alice', UsernameStatus.Registered, { identifier: 'Sibling' })] })).toBe(UsernameAvailability.OwnedByWallet)
    expect(usernameAvailability({ ...nameless, walletUsernames: [username('alice', UsernameStatus.Locked)] })).toBe(UsernameAvailability.Taken)
    expect(usernameAvailability({ ...nameless, walletUsernames: [username('alice', UsernameStatus.Missing)] })).toBe(UsernameAvailability.Available)
  })

  it('is available when only longer names share the prefix', () => {
    expect(usernameAvailability({ ...base, normalized: 'a11' })).toBe(UsernameAvailability.Available)
  })
})

describe('joinClosesAt', () => {
  it('closes the join window halfway through the poll on each network', () => {
    expect(joinClosesAt({ voteEndsAt: 10_000_000 }, 'testnet')).toBe(7_300_000)
    expect(joinClosesAt({ voteEndsAt: 2_000_000_000 }, 'mainnet')).toBe(1_395_200_000)
    expect(joinClosesAt({ voteEndsAt: null }, 'testnet')).toBeNull()
  })
})

describe('usernameCaption', () => {
  const row = (entry: UsernameDto) => mergeIdentityUsernames([], [entry], ME)[0]

  it('gives a registered row no caption, listed or synthesized', () => {
    expect(usernameCaption(row(username('alice', UsernameStatus.Registered)), NOW)).toBeNull()
    expect(usernameCaption(mergeIdentityUsernames(['alice.dash'], [], ME)[0], NOW)).toBeNull()
  })

  it('shows the countdown and our tally for a name in a vote, not a rival’s', () => {
    const voting = username('alice', UsernameStatus.Voting, {
      voteEndsAt: NOW + 3 * 86_400_000 + 14 * 3_600_000,
      contenders: [{ identifier: 'Rival', votes: 20 }, { identifier: ME, votes: 12 }],
      votesLock: 3,
      votesAbstain: 1,
    })
    expect(usernameCaption(row(voting), NOW)).toBe('Ends in 3d 14h · 12 for you · 3 lock · 1 abstain')
  })

  it('says the vote ended or is in progress instead of a countdown, counting missing tallies as zero', () => {
    expect(usernameCaption(row(username('alice', UsernameStatus.Voting, { voteEndsAt: NOW - 3_600_000 })), NOW))
      .toBe('Voting ended · 0 for you · 0 lock · 0 abstain')
    expect(usernameCaption(row(username('alice', UsernameStatus.Voting, { votesLock: 2 })), NOW))
      .toBe('Vote in progress · 0 for you · 2 lock · 0 abstain')
  })

  it('uses the static caption for terminal states', () => {
    expect(usernameCaption(row(username('vault', UsernameStatus.Locked)), NOW)).toBe(USERNAME_PRESENTATION[UsernamePresentation.Locked].caption)
    expect(usernameCaption(row(username('river', UsernameStatus.Missing)), NOW)).toBe(USERNAME_PRESENTATION[UsernamePresentation.Missing].caption)
  })
})

describe('voteTiming', () => {
  it('counts down an open vote and never prints a negative or missing end', () => {
    expect(voteTiming(NOW + 2 * 3_600_000, NOW)).toBe('Ends in 2h 00m')
    expect(voteTiming(NOW, NOW)).toBe('Voting ended')
    expect(voteTiming(null, NOW)).toBe('Vote in progress')
  })
})

describe('contestStandings', () => {
  it('ranks contenders by votes and marks this identity', () => {
    const standings = contestStandings(username('alice', UsernameStatus.Voting, {
      contenders: [{ identifier: ME, votes: 3 }, { identifier: 'Rival', votes: 7 }, { identifier: 'Late', votes: 0 }],
    }))
    expect(standings).toEqual([
      { identifier: 'Rival', votes: 7, isOwn: false },
      { identifier: ME, votes: 3, isOwn: true },
      { identifier: 'Late', votes: 0, isOwn: false },
    ])
  })

  it('lists nobody for an uncontested name', () => {
    expect(contestStandings(username('alice', UsernameStatus.Registered))).toEqual([])
  })
})

describe('voteOutcomeLabel', () => {
  it('names who won, a lock or no winner, and nothing while the vote runs', () => {
    expect(voteOutcomeLabel(username('a', UsernameStatus.Registered, { voteOutcome: UsernameVoteOutcome.WonByIdentity, voteWinner: ME })))
      .toBe('Won by this identity')
    expect(voteOutcomeLabel(username('a', UsernameStatus.Taken, { voteOutcome: UsernameVoteOutcome.WonByIdentity, voteWinner: 'Rival' })))
      .toBe('Won by another identity')
    expect(voteOutcomeLabel(username('a', UsernameStatus.Locked, { voteOutcome: UsernameVoteOutcome.Locked }))).toBe('Locked by masternodes')
    expect(voteOutcomeLabel(username('a', UsernameStatus.Missing, { voteOutcome: UsernameVoteOutcome.NoWinner }))).toBe('No winner')
    expect(voteOutcomeLabel(username('a', UsernameStatus.Voting))).toBeNull()
  })
})
