import type { AliasDto, Network } from '@renderer/api/types'
import { DASHPAY_PARAMS, DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import {
  REGISTER_ALLOWED_AVAILABILITY,
  REGISTER_SIGN_COPY,
  USERNAME_CAPTION_EXTRA,
  USERNAME_TITLE_ELLIPSIS,
  USERNAME_TITLE_HEAD,
  USERNAME_TITLE_TAIL,
  USERNAME_TYPE_COPY,
} from '@renderer/constants/dashPayUsernames'
import { ALIAS_PRESENTATION, USERNAME_CAPTION_COPY, USERNAME_ORDER, VOTE_POLL_DURATION_LABEL } from '@renderer/constants/dpns'
import { MASTERNODE_PARAMS, MASTERNODES_ROUTE } from '@renderer/constants/masternodes'
import { AliasPresentation } from '@renderer/enums/DashPay'
import { MasternodesTab } from '@renderer/enums/Masternodes'
import type { RegisterGateInput } from '@renderer/types/DashPayUsernames'
import type { UsernameRowModel } from '@renderer/types/Dpns'
import { formatCreationDate } from './date'
import { withParams } from './searchParams'
import { formatTimeLeft } from './timeLeft'
import { aliasPresentation, usernameCaption } from './usernames'

export function voteTallies(alias: Pick<AliasDto, 'votesFor' | 'votesLock' | 'votesAbstain'>): string {
  const { separator, forYou, lock, abstain } = USERNAME_CAPTION_COPY
  return [
    `${alias.votesFor ?? 0} ${forYou}`,
    `${alias.votesLock ?? 0} ${lock}`,
    `${alias.votesAbstain ?? 0} ${abstain}`,
  ].join(separator)
}

export function voteTiming(voteEndsAt: number | null, now: number): string {
  if (voteEndsAt == null) return USERNAME_CAPTION_EXTRA.voteOpen
  if (voteEndsAt <= now) return USERNAME_CAPTION_EXTRA.voteEnded
  return `${USERNAME_CAPTION_EXTRA.endsIn} ${formatTimeLeft(voteEndsAt, now)}`
}

export function usernameRowCaption(row: UsernameRowModel, now: number): string | null {
  const alias = row.alias
  if (row.presentation === AliasPresentation.Registered) {
    return alias == null ? null : `${USERNAME_CAPTION_EXTRA.added} ${formatCreationDate(new Date(alias.createdAt))}`
  }
  if (row.presentation === AliasPresentation.Voting && alias != null) {
    return `${voteTiming(alias.voteEndsAt, now)}${USERNAME_CAPTION_COPY.separator}${voteTallies(alias)}`
  }
  return usernameCaption(row, now)
}

export function usernameTitle(fullName: string): string {
  if (fullName.length <= USERNAME_TITLE_HEAD + USERNAME_TITLE_TAIL + USERNAME_TITLE_ELLIPSIS.length) return fullName
  return `${fullName.slice(0, USERNAME_TITLE_HEAD)}${USERNAME_TITLE_ELLIPSIS}${fullName.slice(-USERNAME_TITLE_TAIL)}`
}

export function primaryFirst(rows: UsernameRowModel[]): UsernameRowModel[] {
  return [...rows].sort((a, b) => USERNAME_ORDER.indexOf(a.presentation) - USERNAME_ORDER.indexOf(b.presentation)
    || Number(b.isPrimary) - Number(a.isPrimary))
}

export function contestHref(normalizedLabel: string): string {
  return `${MASTERNODES_ROUTE}?${withParams('', {
    [MASTERNODE_PARAMS.tab]: MasternodesTab.Contests,
    [MASTERNODE_PARAMS.contest]: normalizedLabel,
  })}`
}

export function registerUsernameHref(identifier: string, label: string | null): string {
  return `${DASHPAY_ROUTES.registerUsername}?${withParams('', {
    [DASHPAY_PARAMS.identity]: identifier,
    [DASHPAY_PARAMS.label]: label,
  })}`
}

export function usernameTypeLabel(contested: boolean, network: Network | null): string {
  if (!contested) return USERNAME_TYPE_COPY.instant
  return network == null ? USERNAME_TYPE_COPY.contest : `${USERNAME_TYPE_COPY.contest} · ${VOTE_POLL_DURATION_LABEL[network]}`
}

export function balanceAfterFee(balance: bigint, fee: bigint | null): bigint | null {
  return fee == null ? null : balance - fee
}

export function feeShortfall(balance: bigint, fee: bigint | null): bigint | null {
  return fee != null && fee > balance ? fee - balance : null
}

export function registerCanAdvance(input: RegisterGateInput): boolean {
  return input.issue == null
    && input.canRegister
    && (input.resumable || REGISTER_ALLOWED_AVAILABILITY.includes(input.availability))
    && input.feeReady
    && input.feeCredits != null
    && feeShortfall(input.balance, input.feeCredits) == null
}

export function registerDoneNote(
  alias: Pick<AliasDto, 'status' | 'preorderSalt' | 'voteEndsAt'>,
  network: Network | null,
  now: number,
): string {
  const presentation = aliasPresentation(alias)
  if (presentation === AliasPresentation.Registered) return REGISTER_SIGN_COPY.noteRegistered
  if (presentation === AliasPresentation.Pending) return REGISTER_SIGN_COPY.notePending
  if (presentation !== AliasPresentation.Voting) return ALIAS_PRESENTATION[presentation].caption
  const duration = network != null ? VOTE_POLL_DURATION_LABEL[network] : formatTimeLeft(alias.voteEndsAt ?? now, now)
  return `${REGISTER_SIGN_COPY.noteContestLead} ${duration}.`
}
