import type { DashPayContactDto } from '@renderer/api/types'
import {
  AliasPresentation,
  ContactSort,
  DashPayContactRelationship,
  DashPayReadiness,
  OverviewAction,
  OverviewBand,
  SetupStepState,
} from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { DashPayReadinessInfo, SetupStepModel } from '@renderer/types/DashPay'
import type { OverviewBandModel, UsernameSummary } from '@renderer/types/DashPayOverview'
import type { UsernameRowModel } from '@renderer/types/Dpns'
import { contactsForIdentity, sortContacts } from './dashPayContactList'

function bandOf(contacts: DashPayContactDto[], kind: OverviewBand, limit: number): OverviewBandModel | null {
  if (contacts.length === 0) return null
  return { kind, total: contacts.length, rows: sortContacts(contacts, ContactSort.Recent).slice(0, limit) }
}

export function overviewBand(contacts: DashPayContactDto[], identifier: string, limit: number): OverviewBandModel | null {
  const own = contactsForIdentity(contacts, identifier)
  const requests = own.filter(contact => contact.relationship === DashPayContactRelationship.Incoming)
  const established = own.filter(contact => contact.relationship === DashPayContactRelationship.Established)
  return bandOf(requests, OverviewBand.Requests, limit) ?? bandOf(established, OverviewBand.Recent, limit)
}

export function orbitIdentifiers(contacts: DashPayContactDto[], identifier: string, count: number): string[] {
  return sortContacts(contactsForIdentity(contacts, identifier), ContactSort.Recent)
    .slice(0, count)
    .map(contact => contact.contactId)
}

export function overviewActions(identity: IdentityApiDto | null, readiness: DashPayReadinessInfo | null): OverviewAction[] {
  if (identity == null || readiness == null) return [OverviewAction.CreateIdentity]
  const actions: OverviewAction[] = []
  if (readiness.missingKeys.length > 0 && readiness.readiness !== DashPayReadiness.NoKeySlots) actions.push(OverviewAction.EnableDashPay)
  if (identity.aliasesList.length === 0) actions.push(OverviewAction.RegisterUsername)
  actions.push(OverviewAction.FindPeople)
  return actions.slice(0, 2)
}

export function completedSetupSteps(steps: SetupStepModel[]): number {
  return steps.filter(step => step.state === SetupStepState.Done).length
}

export function usernameSummary(rows: UsernameRowModel[]): UsernameSummary {
  return { total: rows.length, inVote: rows.filter(row => row.presentation === AliasPresentation.Voting).length }
}
