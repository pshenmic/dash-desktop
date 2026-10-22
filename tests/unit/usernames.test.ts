import { describe, expect, it } from 'vitest'
import {
  aliasPresentation,
  findResumableAlias,
  joinClosesAt,
  mergeIdentityUsernames,
  usernameAvailability,
  usernameCaption,
  usernameOrder,
  voteTiming,
} from '../../src/renderer/src/utils/usernames'
import { normalizeDpnsLabel } from '../../src/renderer/src/utils/dpnsLabel'
import { AliasPresentation, AliasStatus, UsernameAvailability } from '../../src/renderer/src/enums/DashPay'
import { ALIAS_PRESENTATION } from '../../src/renderer/src/constants/dpns'
import type { AliasDto } from '../../src/renderer/src/api/types'
import type { UsernameAvailabilityInput } from '../../src/renderer/src/types/Dpns'

const ME = 'MyIdentity'
const SALT = new Uint8Array(32)
const NOW = new Date(2026, 9, 22, 12).getTime()

function alias(label: string, status: AliasStatus, overrides: Partial<AliasDto> = {}): AliasDto {
  return {
    walletId: 'wallet',
    identifier: ME,
    label,
    normalizedLabel: normalizeDpnsLabel(label),
    isContested: false,
    status,
    documentId: null,
    preorderSalt: null,
    votesFor: null,
    votesLock: null,
    votesAbstain: null,
    voteEndsAt: null,
    createdAt: 1_000,
    checkedAt: null,
    ...overrides,
  }
}

describe('aliasPresentation', () => {
  it('maps every status and splits missing by its preorder salt', () => {
    expect(aliasPresentation(alias('a', AliasStatus.Pending))).toBe(AliasPresentation.Pending)
    expect(aliasPresentation(alias('a', AliasStatus.Registered))).toBe(AliasPresentation.Registered)
    expect(aliasPresentation(alias('a', AliasStatus.Voting))).toBe(AliasPresentation.Voting)
    expect(aliasPresentation(alias('a', AliasStatus.Locked))).toBe(AliasPresentation.Locked)
    expect(aliasPresentation(alias('a', AliasStatus.Taken))).toBe(AliasPresentation.Taken)
    expect(aliasPresentation(alias('a', AliasStatus.Missing))).toBe(AliasPresentation.Missing)
    expect(aliasPresentation(alias('a', AliasStatus.Missing, { preorderSalt: SALT }))).toBe(AliasPresentation.Resumable)
  })
})

describe('mergeIdentityUsernames', () => {
  const aliases = [
    alias('bbbbbbbasa', AliasStatus.Registered, { createdAt: 100 }),
    alias('bbbbbbbasa-pay', AliasStatus.Voting, { isContested: true, voteEndsAt: NOW }),
    alias('bbbbbbbasa2026', AliasStatus.Pending),
    alias('river2026', AliasStatus.Missing, { preorderSalt: SALT }),
    alias('kai', AliasStatus.Missing, { isContested: true }),
    alias('nova', AliasStatus.Taken, { isContested: true }),
    alias('vault', AliasStatus.Locked, { isContested: true }),
    alias('other', AliasStatus.Registered, { identifier: 'OtherIdentity' }),
  ]
  const rows = mergeIdentityUsernames(['bbbbbbbasa.dash', 'Bbbbbbbasa2.dash'], aliases, ME)

  it('keeps this identity’s rows and orders actionable names first', () => {
    expect(rows.map(row => [row.label, row.presentation])).toEqual([
      ['river2026', AliasPresentation.Resumable],
      ['bbbbbbbasa-pay', AliasPresentation.Voting],
      ['bbbbbbbasa2026', AliasPresentation.Pending],
      ['bbbbbbbasa', AliasPresentation.Registered],
      ['Bbbbbbbasa2', AliasPresentation.Registered],
      ['nova', AliasPresentation.Taken],
      ['vault', AliasPresentation.Locked],
      ['kai', AliasPresentation.Missing],
    ])
  })

  it('synthesizes a registered row for an owned name without a row', () => {
    expect(rows.find(row => row.label === 'Bbbbbbbasa2')).toEqual({
      label: 'Bbbbbbbasa2',
      normalizedLabel: 'bbbbbbbasa2',
      fullName: 'Bbbbbbbasa2.dash',
      presentation: AliasPresentation.Registered,
      isContested: false,
      isPrimary: false,
      alias: null,
    })
  })

  it('marks the oldest owned name as primary', () => {
    expect(rows.filter(row => row.isPrimary).map(row => row.label)).toEqual(['bbbbbbbasa'])
  })

  it('dedupes an owned name against its row by the normalized label', () => {
    const merged = mergeIdentityUsernames(['A1ice.dash'], [alias('Alice', AliasStatus.Registered)], ME)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ label: 'Alice', isPrimary: true })
  })
})

describe('usernameOrder', () => {
  it('sorts registered names newest first', () => {
    const merged = mergeIdentityUsernames([], [
      alias('older', AliasStatus.Registered, { createdAt: 1 }),
      alias('newer', AliasStatus.Registered, { createdAt: 2 }),
    ], ME)
    expect(merged.map(row => row.label)).toEqual(['newer', 'older'])
    expect(usernameOrder(merged[0], merged[1])).toBeLessThan(0)
  })
})

describe('findResumableAlias', () => {
  const aliases = [
    alias('river2026', AliasStatus.Missing, { preorderSalt: SALT }),
    alias('kai', AliasStatus.Missing),
    alias('nova', AliasStatus.Missing, { preorderSalt: SALT, identifier: 'OtherIdentity' }),
  ]

  it('finds a paid preorder of this identity by its normalized label', () => {
    expect(findResumableAlias(aliases, ME, normalizeDpnsLabel('River2026'))?.label).toBe('river2026')
  })

  it('ignores missing rows without a salt and other identities’ rows', () => {
    expect(findResumableAlias(aliases, ME, 'ka1')).toBeNull()
    expect(findResumableAlias(aliases, ME, 'n0va')).toBeNull()
  })
})

describe('usernameAvailability', () => {
  const base: UsernameAvailabilityInput = {
    normalized: 'a11ce',
    identifier: ME,
    walletIdentifiers: new Set([ME]),
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
  const row = (entry: AliasDto) => mergeIdentityUsernames([], [entry], ME)[0]

  it('dates a registered row by when it was added and gives a synthesized one no caption', () => {
    expect(usernameCaption(row(alias('alice', AliasStatus.Registered, { createdAt: new Date(2026, 9, 3, 12).getTime() })), NOW))
      .toBe('Added 3 Oct 2026')
    expect(usernameCaption(mergeIdentityUsernames(['alice.dash'], [], ME)[0], NOW)).toBeNull()
  })

  it('shows when a pending name was last checked', () => {
    expect(usernameCaption(row(alias('alice', AliasStatus.Pending, { checkedAt: NOW - 60_000 })), NOW))
      .toBe('Waiting for the network · checked 1m ago')
  })

  it('shows the countdown and our tally for a name in a vote', () => {
    const voting = alias('alice', AliasStatus.Voting, {
      voteEndsAt: NOW + 3 * 86_400_000 + 14 * 3_600_000,
      votesFor: 12,
      votesLock: 3,
      votesAbstain: 1,
    })
    expect(usernameCaption(row(voting), NOW)).toBe('Ends in 3d 14h · 12 for you · 3 lock · 1 abstain')
  })

  it('says the vote ended or is in progress instead of a countdown, counting missing tallies as zero', () => {
    expect(usernameCaption(row(alias('alice', AliasStatus.Voting, { voteEndsAt: NOW - 3_600_000 })), NOW))
      .toBe('Voting ended · 0 for you · 0 lock · 0 abstain')
    expect(usernameCaption(row(alias('alice', AliasStatus.Voting, { votesLock: 2 })), NOW))
      .toBe('Vote in progress · 0 for you · 2 lock · 0 abstain')
  })

  it('uses the static caption for terminal states', () => {
    expect(usernameCaption(row(alias('vault', AliasStatus.Locked)), NOW)).toBe(ALIAS_PRESENTATION[AliasPresentation.Locked].caption)
    expect(usernameCaption(row(alias('river', AliasStatus.Missing, { preorderSalt: SALT })), NOW))
      .toBe(ALIAS_PRESENTATION[AliasPresentation.Resumable].caption)
  })
})

describe('voteTiming', () => {
  it('counts down an open vote and never prints a negative or missing end', () => {
    expect(voteTiming(NOW + 2 * 3_600_000, NOW)).toBe('Ends in 2h 00m')
    expect(voteTiming(NOW, NOW)).toBe('Voting ended')
    expect(voteTiming(null, NOW)).toBe('Vote in progress')
  })
})
