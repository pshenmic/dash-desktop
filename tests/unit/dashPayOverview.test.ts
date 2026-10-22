import { describe, expect, it } from 'vitest'
import {
  completedSetupSteps,
  orbitIdentifiers,
  overviewActions,
  overviewBand,
  usernameSummary,
} from '../../src/renderer/src/utils/dashPayOverview'
import { dashPayReadiness, setupSteps } from '../../src/renderer/src/utils/dashPayReadiness'
import {
  AliasPresentation,
  DashPayContactRelationship,
  OverviewAction,
  OverviewBand,
} from '../../src/renderer/src/enums/DashPay'
import type { DashPayContactDto, IdentityKeyDto } from '../../src/renderer/src/api/types'
import type { IdentityApiDto } from '../../src/renderer/src/hooks/useIdentities'
import type { UsernameRowModel } from '../../src/renderer/src/types/Dpns'

function key(keyId: number, purpose: string, securityLevel: string): IdentityKeyDto {
  return { keyId, purpose, securityLevel, keyType: 'ECDSA_SECP256K1', disabled: false, contractBounds: null }
}

const DASHPAY_KEYS = [key(0, 'AUTHENTICATION', 'MASTER'), key(1, 'AUTHENTICATION', 'HIGH'), key(2, 'ENCRYPTION', 'MEDIUM'), key(3, 'DECRYPTION', 'MEDIUM')]
const SIGNING_ONLY = [key(0, 'AUTHENTICATION', 'MASTER'), key(1, 'AUTHENTICATION', 'HIGH')]
const FULL_SLOTS = Array.from({ length: 20 }, (_, index) => key(index, 'TRANSFER', 'CRITICAL'))

function identity(identifier: string, aliasesList: string[], keys: IdentityKeyDto[], amount = 1n): IdentityApiDto {
  return {
    identityIndex: 0,
    identifier,
    alias: aliasesList[0] ?? null,
    aliasesList,
    keys,
    balance: { amount, usdAmount: '0.0' },
    derivationPath: '',
    assetLockTxid: null,
  }
}

function contact(identifier: string, contactId: string, relationship: DashPayContactRelationship, at: number): DashPayContactDto {
  return {
    identifier,
    contactId,
    relationship,
    aliasesList: [],
    incomingCreatedAt: at,
    outgoingCreatedAt: null,
    paymentChannelBroken: false,
  }
}

function row(label: string, presentation: AliasPresentation): UsernameRowModel {
  return { label, normalizedLabel: label, fullName: `${label}.dash`, presentation, isContested: false, isPrimary: false, alias: null }
}

const CONTACTS = [
  contact('Me', 'Old', DashPayContactRelationship.Established, 1),
  contact('Me', 'New', DashPayContactRelationship.Established, 5),
  contact('Me', 'Pending', DashPayContactRelationship.Outgoing, 9),
  contact('Other', 'Elsewhere', DashPayContactRelationship.Incoming, 7),
]

describe('overviewBand', () => {
  it('shows incoming requests first, newest first, capped at the limit', () => {
    const contacts = [
      ...CONTACTS,
      contact('Me', 'AskA', DashPayContactRelationship.Incoming, 2),
      contact('Me', 'AskB', DashPayContactRelationship.Incoming, 8),
    ]
    const band = overviewBand(contacts, 'Me', 1)
    expect(band).toEqual({ kind: OverviewBand.Requests, total: 2, rows: [contacts[5]] })
  })

  it('falls back to established contacts and ignores other identities', () => {
    const band = overviewBand(CONTACTS, 'Me', 3)
    expect(band?.kind).toBe(OverviewBand.Recent)
    expect(band?.total).toBe(2)
    expect(band?.rows.map(entry => entry.contactId)).toEqual(['New', 'Old'])
  })

  it('omits the band without requests or contacts', () => {
    expect(overviewBand([contact('Me', 'Pending', DashPayContactRelationship.Outgoing, 1)], 'Me', 3)).toBeNull()
  })
})

describe('orbitIdentifiers', () => {
  it('returns the most recent contacts of the acting identity', () => {
    expect(orbitIdentifiers(CONTACTS, 'Me', 2)).toEqual(['Pending', 'New'])
    expect(orbitIdentifiers(CONTACTS, 'Nobody', 2)).toEqual([])
  })
})

describe('overviewActions', () => {
  it('asks to create an identity when there is none', () => {
    expect(overviewActions(null, null)).toEqual([OverviewAction.CreateIdentity])
  })

  it('puts Enable DashPay before Register username', () => {
    const bare = identity('Bare', [], SIGNING_ONLY.slice(0, 1))
    expect(overviewActions(bare, dashPayReadiness(bare))).toEqual([OverviewAction.EnableDashPay, OverviewAction.RegisterUsername])
  })

  it('offers Find people after the only missing step', () => {
    const named = identity('Named', ['alice.dash'], SIGNING_ONLY)
    expect(overviewActions(named, dashPayReadiness(named))).toEqual([OverviewAction.EnableDashPay, OverviewAction.FindPeople])
    const keyed = identity('Keyed', [], DASHPAY_KEYS)
    expect(overviewActions(keyed, dashPayReadiness(keyed))).toEqual([OverviewAction.RegisterUsername, OverviewAction.FindPeople])
  })

  it('never offers Enable DashPay without free key slots', () => {
    const full = identity('Full', ['bob.dash'], FULL_SLOTS)
    expect(overviewActions(full, dashPayReadiness(full))).toEqual([OverviewAction.FindPeople])
  })
})

describe('completedSetupSteps', () => {
  it('counts only done steps', () => {
    const ready = identity('Ready', ['alice.dash'], DASHPAY_KEYS)
    expect(completedSetupSteps(setupSteps(ready, dashPayReadiness(ready)))).toBe(3)
    const broke = identity('Broke', ['alice.dash'], DASHPAY_KEYS, 0n)
    expect(completedSetupSteps(setupSteps(broke, dashPayReadiness(broke)))).toBe(2)
    expect(completedSetupSteps(setupSteps(null, null))).toBe(0)
  })
})

describe('usernameSummary', () => {
  it('counts names and the ones in a vote', () => {
    const rows = [row('a', AliasPresentation.Registered), row('b', AliasPresentation.Voting), row('c', AliasPresentation.Pending)]
    expect(usernameSummary(rows)).toEqual({ total: 3, inVote: 1 })
    expect(usernameSummary([])).toEqual({ total: 0, inVote: 0 })
  })
})
