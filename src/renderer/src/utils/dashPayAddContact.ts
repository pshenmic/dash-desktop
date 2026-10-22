import type { AliasSearchResultDto } from '@renderer/api/types'
import { ALIAS_SEARCH_RESULT_CAP } from '@renderer/constants/dashPay'
import { SELECTABLE_SEARCH_RESULT_STATES } from '@renderer/constants/dashPayAddContact'
import type { SearchResultState } from '@renderer/enums/DashPay'
import type { AddContactResultRow, AddContactRowContext } from '@renderer/types/DashPayAddContact'
import { searchResultState } from './dashPayContactList'
import { normalizeDpnsLabel, stripDpnsInput } from './dpnsLabel'

export function aliasSearchPrefix(query: string): string {
  return normalizeDpnsLabel(stripDpnsInput(query))
}

export function addContactRows(results: AliasSearchResultDto[], context: AddContactRowContext): AddContactResultRow[] {
  const rows = new Map<string, AddContactResultRow>()
  for (const result of results) {
    const row = rows.get(result.identifier)
    if (row != null) {
      row.extraNames += 1
      continue
    }
    rows.set(result.identifier, {
      identifier: result.identifier,
      name: result.name,
      extraNames: 0,
      state: searchResultState(result, context.actingIdentifier, context.contacts, context.walletIdentifiers),
    })
  }
  return Array.from(rows.values())
}

export function identifierResultRow(query: string, context: AddContactRowContext): AddContactResultRow {
  const identifier = query.trim()
  return {
    identifier,
    name: null,
    extraNames: 0,
    state: searchResultState({ identifier }, context.actingIdentifier, context.contacts, context.walletIdentifiers),
  }
}

export function isSelectableResult(state: SearchResultState): boolean {
  return SELECTABLE_SEARCH_RESULT_STATES.has(state)
}

export function isAliasSearchCapped(results: AliasSearchResultDto[]): boolean {
  return results.length >= ALIAS_SEARCH_RESULT_CAP
}

export function resultRowLabel(row: Pick<AddContactResultRow, 'identifier' | 'name'>): string {
  return row.name ?? row.identifier
}
