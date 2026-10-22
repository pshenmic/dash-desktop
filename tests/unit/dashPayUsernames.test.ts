import { describe, expect, it } from 'vitest'
import {
  balanceAfterFee,
  contestHref,
  feeShortfall,
  primaryFirst,
  registerCanAdvance,
  registerDoneNote,
  registerUsernameHref,
  usernameRowCaption,
  usernameTitle,
  usernameTypeLabel,
  voteTallies,
  voteTiming,
} from '../../src/renderer/src/utils/dashPayUsernames'
import { mergeIdentityUsernames } from '../../src/renderer/src/utils/usernames'
import { normalizeDpnsLabel } from '../../src/renderer/src/utils/dpnsLabel'
import { formatCreationDate } from '../../src/renderer/src/utils/date'
import { AliasPresentation, AliasStatus, DpnsLabelIssue, UsernameAvailability } from '../../src/renderer/src/enums/DashPay'
import { ALIAS_PRESENTATION } from '../../src/renderer/src/constants/dpns'
import { REGISTER_SIGN_COPY, USERNAME_TYPE_COPY } from '../../src/renderer/src/constants/dashPayUsernames'
import type { AliasDto } from '../../src/renderer/src/api/types'
import type { RegisterGateInput } from '../../src/renderer/src/types/DashPayUsernames'

const ME = 'MyIdentity'
const NOW = new Date(2026, 9, 22, 12).getTime()
const HOUR = 3_600_000

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
    createdAt: NOW - 24 * HOUR,
    checkedAt: null,
    ...overrides,
  }
}

function rowFor(item: AliasDto) {
  return mergeIdentityUsernames([], [item], ME)[0]
}

function gate(overrides: Partial<RegisterGateInput> = {}): RegisterGateInput {
  return {
    issue: null,
    canRegister: true,
    resumable: false,
    availability: UsernameAvailability.Available,
    feeCredits: 100n,
    feeReady: true,
    balance: 1_000n,
    ...overrides,
  }
}

describe('usernameRowCaption', () => {
  it('labels a registered row with the date it was added, not a registration date', () => {
    const item = alias('alice', AliasStatus.Registered)
    expect(usernameRowCaption(rowFor(item), NOW)).toBe(`Added ${formatCreationDate(new Date(item.createdAt))}`)
  })

  it('has no caption for a name that only the identity lists', () => {
    const [row] = mergeIdentityUsernames(['bob.dash'], [], ME)
    expect(usernameRowCaption(row, NOW)).toBeNull()
  })

  it('shows the countdown and tallies while the vote is open', () => {
    const item = alias('pay', AliasStatus.Voting, { votesFor: 12, votesLock: 3, votesAbstain: 1, voteEndsAt: NOW + 2 * HOUR })
    expect(usernameRowCaption(rowFor(item), NOW)).toBe('Ends in 2h 00m · 12 for you · 3 lock · 1 abstain')
  })

  it('says voting ended instead of a negative countdown', () => {
    const item = alias('pay', AliasStatus.Voting, { voteEndsAt: NOW - HOUR })
    expect(usernameRowCaption(rowFor(item), NOW)).toBe('Voting ended · 0 for you · 0 lock · 0 abstain')
  })

  it('falls back to the presentation caption for the other statuses', () => {
    const item = alias('gone', AliasStatus.Missing, { preorderSalt: new Uint8Array(32) })
    expect(usernameRowCaption(rowFor(item), NOW)).toBe(ALIAS_PRESENTATION[AliasPresentation.Resumable].caption)
  })
})

describe('primaryFirst', () => {
  it('lifts the primary name to the top of its status group only', () => {
    const rows = mergeIdentityUsernames(['zed.dash'], [
      alias('zed', AliasStatus.Registered),
      alias('amy', AliasStatus.Registered),
      alias('pay', AliasStatus.Voting, { voteEndsAt: NOW + HOUR }),
    ], ME)
    expect(primaryFirst(rows).map(row => row.label)).toEqual(['pay', 'zed', 'amy'])
    expect(rows.map(row => row.label)).toEqual(['pay', 'amy', 'zed'])
  })
})

describe('vote helpers', () => {
  it('counts missing tallies as zero', () => {
    expect(voteTallies({ votesFor: null, votesLock: 2, votesAbstain: null })).toBe('0 for you · 2 lock · 0 abstain')
  })

  it('reads an unknown end as in progress', () => {
    expect(voteTiming(null, NOW)).toBe('Vote in progress')
  })
})

describe('hrefs', () => {
  it('links a contest by its normalized label', () => {
    expect(contestHref('a11ce')).toBe('/masternodes?tab=contests&contest=a11ce')
  })

  it('prefills the register wizard', () => {
    expect(registerUsernameHref('Id1', 'Alice')).toBe('/dashpay/usernames/new?identity=Id1&label=Alice')
    expect(registerUsernameHref('Id1', null)).toBe('/dashpay/usernames/new?identity=Id1')
  })
})

describe('usernameTitle', () => {
  it('keeps a short name and shortens a long one in the middle', () => {
    expect(usernameTitle('alice.dash')).toBe('alice.dash')
    const long = 'owl352-e2e-long-6356-0123456789abcdefghjkmnpqrstuvwxyz012345678.dash'
    expect(usernameTitle(long)).toBe('owl352-e2e-long-63…45678.dash')
  })
})

describe('usernameTypeLabel', () => {
  it('names the network poll length for contested names', () => {
    expect(usernameTypeLabel(true, 'testnet')).toBe(`${USERNAME_TYPE_COPY.contest} · 90 minutes`)
    expect(usernameTypeLabel(true, 'mainnet')).toBe(`${USERNAME_TYPE_COPY.contest} · 14 days`)
    expect(usernameTypeLabel(true, null)).toBe(USERNAME_TYPE_COPY.contest)
    expect(usernameTypeLabel(false, 'testnet')).toBe(USERNAME_TYPE_COPY.instant)
  })
})

describe('fee math', () => {
  it('subtracts a known fee', () => {
    expect(balanceAfterFee(1_000n, 300n)).toBe(700n)
    expect(balanceAfterFee(1_000n, null)).toBeNull()
  })

  it('reports only a positive shortfall', () => {
    expect(feeShortfall(100n, 250n)).toBe(150n)
    expect(feeShortfall(250n, 250n)).toBeNull()
    expect(feeShortfall(100n, null)).toBeNull()
  })
})

describe('registerCanAdvance', () => {
  it('passes a valid, available, affordable name', () => {
    expect(registerCanAdvance(gate())).toBe(true)
  })

  it('lets a failed availability check through', () => {
    expect(registerCanAdvance(gate({ availability: UsernameAvailability.Error }))).toBe(true)
  })

  it('blocks taken, owned and still-checking names unless the preorder is resumable', () => {
    expect(registerCanAdvance(gate({ availability: UsernameAvailability.Taken }))).toBe(false)
    expect(registerCanAdvance(gate({ availability: UsernameAvailability.OwnedByWallet }))).toBe(false)
    expect(registerCanAdvance(gate({ availability: UsernameAvailability.Checking }))).toBe(false)
    expect(registerCanAdvance(gate({ availability: UsernameAvailability.Idle, resumable: true }))).toBe(true)
  })

  it('blocks an invalid label, a missing key, an unready fee and a shortfall', () => {
    expect(registerCanAdvance(gate({ issue: DpnsLabelIssue.TooShort }))).toBe(false)
    expect(registerCanAdvance(gate({ canRegister: false }))).toBe(false)
    expect(registerCanAdvance(gate({ feeReady: false }))).toBe(false)
    expect(registerCanAdvance(gate({ feeCredits: null }))).toBe(false)
    expect(registerCanAdvance(gate({ balance: 50n }))).toBe(false)
  })
})

describe('registerDoneNote', () => {
  it('matches the returned status', () => {
    expect(registerDoneNote(alias('a', AliasStatus.Registered), 'testnet', NOW)).toBe(REGISTER_SIGN_COPY.noteRegistered)
    expect(registerDoneNote(alias('a', AliasStatus.Pending), 'testnet', NOW)).toBe(REGISTER_SIGN_COPY.notePending)
    expect(registerDoneNote(alias('a', AliasStatus.Voting), 'testnet', NOW)).toBe(`${REGISTER_SIGN_COPY.noteContestLead} 90 minutes.`)
  })
})
