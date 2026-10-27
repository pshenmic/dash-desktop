import type { UsernameDto, Network } from '@renderer/api/types'
import {
  USERNAME_PRESENTATION,
  USERNAME_STATUS_PRESENTATION,
  CONTEST_JOIN_WINDOW_MS,
  USERNAME_CAPTION_COPY,
  USERNAME_ORDER,
  VOTE_POLL_DURATION_MS,
  WALLET_USERNAME_CLAIM_STATUSES,
} from '@renderer/constants/dpns'
import { USERNAME_VOTE_OUTCOME_COPY } from '@renderer/constants/dashPayUsernames'
import { NAME_COLLATOR } from '@renderer/constants/listToolbar'
import { UsernamePresentation, UsernameStatus, UsernameAvailability, UsernameVoteOutcome } from '@renderer/enums/DashPay'
import type { ContestStanding, UsernameAvailabilityInput, UsernameRowModel } from '@renderer/types/Dpns'
import { exactUsernameMatch, fullDpnsName, isContestedLabel, normalizeDpnsLabel, stripDpnsInput } from './dpnsLabel'
import { formatTimeLeft } from './timeLeft'

export function usernamePresentation(username: Pick<UsernameDto, 'status'>): UsernamePresentation {
  return USERNAME_STATUS_PRESENTATION[username.status]
}

export function ownContenderVotes(username: Pick<UsernameDto, 'identifier' | 'contenders'>): number {
  return username.contenders.find(contender => contender.identifier === username.identifier)?.votes ?? 0
}

export function contestStandings(username: Pick<UsernameDto, 'identifier' | 'contenders'>): ContestStanding[] {
  return [...username.contenders]
    .sort((a, b) => b.votes - a.votes)
    .map(contender => ({ ...contender, isOwn: contender.identifier === username.identifier }))
}

export function voteOutcomeLabel(username: Pick<UsernameDto, 'identifier' | 'voteOutcome' | 'voteWinner'>): string | null {
  switch (username.voteOutcome) {
    case UsernameVoteOutcome.WonByIdentity:
      return username.voteWinner === username.identifier ? USERNAME_VOTE_OUTCOME_COPY.wonByThisIdentity : USERNAME_VOTE_OUTCOME_COPY.wonByOther
    case UsernameVoteOutcome.Locked:
      return USERNAME_VOTE_OUTCOME_COPY.locked
    case UsernameVoteOutcome.NoWinner:
      return USERNAME_VOTE_OUTCOME_COPY.noWinner
    default:
      return null
  }
}

export function usernameOrder(a: UsernameRowModel, b: UsernameRowModel): number {
  const byPresentation = USERNAME_ORDER.indexOf(a.presentation) - USERNAME_ORDER.indexOf(b.presentation)
  return byPresentation !== 0 ? byPresentation : NAME_COLLATOR.compare(a.label, b.label)
}

export function mergeIdentityUsernames(names: string[], usernames: UsernameDto[], identifier: string): UsernameRowModel[] {
  const primary = names[0] == null ? null : normalizeDpnsLabel(stripDpnsInput(names[0]))
  const rows = new Map<string, UsernameRowModel>()
  for (const username of usernames) {
    if (username.identifier !== identifier || rows.has(username.normalizedLabel)) continue
    rows.set(username.normalizedLabel, {
      label: username.label,
      normalizedLabel: username.normalizedLabel,
      fullName: fullDpnsName(username.label),
      presentation: usernamePresentation(username),
      isContested: username.isContested,
      isPrimary: username.normalizedLabel === primary,
      username,
    })
  }
  for (const name of names) {
    const label = stripDpnsInput(name)
    const normalizedLabel = normalizeDpnsLabel(label)
    if (rows.has(normalizedLabel)) continue
    rows.set(normalizedLabel, {
      label,
      normalizedLabel,
      fullName: fullDpnsName(label),
      presentation: UsernamePresentation.Registered,
      isContested: isContestedLabel(label),
      isPrimary: normalizedLabel === primary,
      username: null,
    })
  }
  return Array.from(rows.values()).sort(usernameOrder)
}

export function walletUsernameClaim(usernames: UsernameDto[], normalized: string): UsernameDto | null {
  return usernames.find(entry => entry.normalizedLabel === normalized && WALLET_USERNAME_CLAIM_STATUSES.includes(entry.status)) ?? null
}

export function usernameAvailability(input: UsernameAvailabilityInput): UsernameAvailability {
  if (input.normalized === '') return UsernameAvailability.Idle
  const claim = walletUsernameClaim(input.walletUsernames, input.normalized)
  if (claim?.status === UsernameStatus.Locked) return UsernameAvailability.Taken
  const own = claim?.identifier === input.identifier
  if (claim?.status === UsernameStatus.Voting) return own ? UsernameAvailability.InContest : UsernameAvailability.InWalletContest
  if (claim != null) return own ? UsernameAvailability.Owned : UsernameAvailability.OwnedByWallet
  if (input.error != null) return UsernameAvailability.Error
  if (input.loading || input.results == null) return UsernameAvailability.Checking
  const match = exactUsernameMatch(input.results, input.normalized)
  if (match == null) return UsernameAvailability.Available
  if (match.identifier === input.identifier) return UsernameAvailability.Owned
  return input.walletIdentifiers.has(match.identifier) ? UsernameAvailability.OwnedByWallet : UsernameAvailability.Taken
}

export function joinClosesAt(username: Pick<UsernameDto, 'voteEndsAt'>, network: Network): number | null {
  if (username.voteEndsAt == null) return null
  return username.voteEndsAt - VOTE_POLL_DURATION_MS[network] + CONTEST_JOIN_WINDOW_MS[network]
}

export function voteTiming(voteEndsAt: number | null, now: number): string {
  if (voteEndsAt == null) return USERNAME_PRESENTATION[UsernamePresentation.Voting].caption
  if (voteEndsAt <= now) return USERNAME_CAPTION_COPY.voteEnded
  return `${USERNAME_CAPTION_COPY.endsIn} ${formatTimeLeft(voteEndsAt, now)}`
}

export function usernameCaption(row: UsernameRowModel, now: number): string | null {
  const { caption } = USERNAME_PRESENTATION[row.presentation]
  const { separator, forYou, lock, abstain } = USERNAME_CAPTION_COPY
  const username = row.username
  switch (row.presentation) {
    case UsernamePresentation.Registered:
      return null
    case UsernamePresentation.Voting:
      return username == null ? caption : [
        voteTiming(username.voteEndsAt, now),
        `${ownContenderVotes(username)} ${forYou}`,
        `${username.votesLock ?? 0} ${lock}`,
        `${username.votesAbstain ?? 0} ${abstain}`,
      ].join(separator)
    default:
      return caption
  }
}
