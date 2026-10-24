import type { AliasDto, Network } from '@renderer/api/types'
import {
  ALIAS_PRESENTATION,
  ALIAS_STATUS_PRESENTATION,
  CONTEST_JOIN_WINDOW_MS,
  USERNAME_CAPTION_COPY,
  USERNAME_ORDER,
  VOTE_POLL_DURATION_MS,
} from '@renderer/constants/dpns'
import { NAME_COLLATOR } from '@renderer/constants/listToolbar'
import { AliasPresentation, AliasStatus, UsernameAvailability } from '@renderer/enums/DashPay'
import type { UsernameAvailabilityInput, UsernameRowModel } from '@renderer/types/Dpns'
import { formatCreationDate } from './date'
import { exactAliasMatch, fullDpnsName, isContestedLabel, normalizeDpnsLabel, stripDpnsInput } from './dpnsLabel'
import { formatAgo, formatTimeLeft } from './timeLeft'

export function aliasPresentation(alias: Pick<AliasDto, 'status' | 'preorderSalt'>): AliasPresentation {
  if (alias.status === AliasStatus.Missing && alias.preorderSalt != null) return AliasPresentation.Resumable
  return ALIAS_STATUS_PRESENTATION[alias.status]
}

export function usernameOrder(a: UsernameRowModel, b: UsernameRowModel): number {
  const byPresentation = USERNAME_ORDER.indexOf(a.presentation) - USERNAME_ORDER.indexOf(b.presentation)
  if (byPresentation !== 0) return byPresentation
  const byAge = a.presentation === AliasPresentation.Registered ? (b.alias?.createdAt ?? 0) - (a.alias?.createdAt ?? 0) : 0
  return byAge !== 0 ? byAge : NAME_COLLATOR.compare(a.label, b.label)
}

export function mergeIdentityUsernames(aliasesList: string[], aliases: AliasDto[], identifier: string): UsernameRowModel[] {
  const primary = aliasesList[0] == null ? null : normalizeDpnsLabel(stripDpnsInput(aliasesList[0]))
  const rows = new Map<string, UsernameRowModel>()
  for (const alias of aliases) {
    if (alias.identifier !== identifier || rows.has(alias.normalizedLabel)) continue
    rows.set(alias.normalizedLabel, {
      label: alias.label,
      normalizedLabel: alias.normalizedLabel,
      fullName: fullDpnsName(alias.label),
      presentation: aliasPresentation(alias),
      isContested: alias.isContested,
      isPrimary: alias.normalizedLabel === primary,
      alias,
    })
  }
  for (const name of aliasesList) {
    const label = stripDpnsInput(name)
    const normalizedLabel = normalizeDpnsLabel(label)
    if (rows.has(normalizedLabel)) continue
    rows.set(normalizedLabel, {
      label,
      normalizedLabel,
      fullName: fullDpnsName(label),
      presentation: AliasPresentation.Registered,
      isContested: isContestedLabel(label),
      isPrimary: normalizedLabel === primary,
      alias: null,
    })
  }
  return Array.from(rows.values()).sort(usernameOrder)
}

export function findResumableAlias(aliases: AliasDto[], identifier: string, normalized: string): AliasDto | null {
  return aliases.find(alias => alias.identifier === identifier
    && alias.normalizedLabel === normalized
    && aliasPresentation(alias) === AliasPresentation.Resumable) ?? null
}

export function usernameAvailability(input: UsernameAvailabilityInput): UsernameAvailability {
  if (input.normalized === '') return UsernameAvailability.Idle
  if (input.error != null) return UsernameAvailability.Error
  if (input.loading || input.results == null) return UsernameAvailability.Checking
  const match = exactAliasMatch(input.results, input.normalized)
  if (match == null) return UsernameAvailability.Available
  if (match.identifier === input.identifier) return UsernameAvailability.Owned
  return input.walletIdentifiers.has(match.identifier) ? UsernameAvailability.OwnedByWallet : UsernameAvailability.Taken
}

export function joinClosesAt(alias: Pick<AliasDto, 'voteEndsAt'>, network: Network): number | null {
  if (alias.voteEndsAt == null) return null
  return alias.voteEndsAt - VOTE_POLL_DURATION_MS[network] + CONTEST_JOIN_WINDOW_MS[network]
}

export function voteTiming(voteEndsAt: number | null, now: number): string {
  if (voteEndsAt == null) return ALIAS_PRESENTATION[AliasPresentation.Voting].caption
  if (voteEndsAt <= now) return USERNAME_CAPTION_COPY.voteEnded
  return `${USERNAME_CAPTION_COPY.endsIn} ${formatTimeLeft(voteEndsAt, now)}`
}

export function usernameCaption(row: UsernameRowModel, now: number): string | null {
  const { caption } = ALIAS_PRESENTATION[row.presentation]
  const { separator, added, checked, forYou, lock, abstain } = USERNAME_CAPTION_COPY
  const alias = row.alias
  switch (row.presentation) {
    case AliasPresentation.Registered:
      return alias == null ? null : `${added} ${formatCreationDate(new Date(alias.createdAt))}`
    case AliasPresentation.Pending:
      return alias?.checkedAt == null ? caption : `${caption}${separator}${checked} ${formatAgo(alias.checkedAt, now)}`
    case AliasPresentation.Voting:
      return alias == null ? caption : [
        voteTiming(alias.voteEndsAt, now),
        `${alias.votesFor ?? 0} ${forYou}`,
        `${alias.votesLock ?? 0} ${lock}`,
        `${alias.votesAbstain ?? 0} ${abstain}`,
      ].join(separator)
    default:
      return caption
  }
}
