import type { AliasSearchResultDto } from '@renderer/api/types'
import {
  DPNS_CONTESTED_PATTERN,
  DPNS_EDGE_HYPHEN,
  DPNS_HANDLE_PREFIX,
  DPNS_HOMOGRAPH_MAP,
  DPNS_LABEL_MAX,
  DPNS_LABEL_MIN,
  DPNS_LABEL_PATTERN,
  DPNS_NAME_SUFFIX,
  DPNS_WHITESPACE_PATTERN,
} from '@renderer/constants/dpns'
import { DpnsLabelIssue, DpnsLabelKind } from '@renderer/enums/DashPay'
import type { DpnsLabelCheck } from '@renderer/types/Dpns'

export function stripDpnsInput(raw: string): string {
  let value = raw.replace(DPNS_WHITESPACE_PATTERN, '')
  if (value.startsWith(DPNS_HANDLE_PREFIX)) value = value.slice(DPNS_HANDLE_PREFIX.length)
  if (value.toLowerCase().endsWith(DPNS_NAME_SUFFIX)) value = value.slice(0, -DPNS_NAME_SUFFIX.length)
  return value
}

export function normalizeDpnsLabel(label: string): string {
  return Array.from(label.toLowerCase(), char => DPNS_HOMOGRAPH_MAP[char] ?? char).join('')
}

export function isContestedLabel(label: string): boolean {
  return DPNS_CONTESTED_PATTERN.test(normalizeDpnsLabel(label))
}

function dpnsLabelIssue(label: string): DpnsLabelIssue | null {
  if (label.length < DPNS_LABEL_MIN) return DpnsLabelIssue.TooShort
  if (label.length > DPNS_LABEL_MAX) return DpnsLabelIssue.TooLong
  if (!DPNS_LABEL_PATTERN.test(label)) return DpnsLabelIssue.InvalidChars
  if (label.startsWith(DPNS_EDGE_HYPHEN) || label.endsWith(DPNS_EDGE_HYPHEN)) return DpnsLabelIssue.EdgeHyphen
  return null
}

export function validateDpnsLabel(raw: string): DpnsLabelCheck {
  const label = stripDpnsInput(raw)
  return {
    issue: dpnsLabelIssue(label),
    label,
    normalized: normalizeDpnsLabel(label),
    kind: isContestedLabel(label) ? DpnsLabelKind.Contested : DpnsLabelKind.Instant,
  }
}

export function exactAliasMatch(results: AliasSearchResultDto[], label: string): AliasSearchResultDto | null {
  const wanted = normalizeDpnsLabel(stripDpnsInput(label))
  return results.find(result => normalizeDpnsLabel(stripDpnsInput(result.name)) === wanted) ?? null
}

export function fullDpnsName(label: string): string {
  return `${label}${DPNS_NAME_SUFFIX}`
}

export function matchesIdentityQuery(identifier: string, names: Array<string | null>, query: string): boolean {
  const trimmed = query.trim()
  if (trimmed === '' || identifier.includes(trimmed)) return true
  const wanted = normalizeDpnsLabel(stripDpnsInput(trimmed))
  return names.some(name => name != null && normalizeDpnsLabel(stripDpnsInput(name)).includes(wanted))
}
