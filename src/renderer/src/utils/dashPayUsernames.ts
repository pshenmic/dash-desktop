import type { UsernameDto, Network } from '@renderer/api/types'
import { DASHPAY_PARAMS, DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import {
  REGISTER_ALLOWED_AVAILABILITY,
  REGISTER_SIGN_COPY,
  USERNAME_TITLE_ELLIPSIS,
  USERNAME_TITLE_HEAD,
  USERNAME_TITLE_TAIL,
  USERNAME_TYPE_COPY,
} from '@renderer/constants/dashPayUsernames'
import { USERNAME_PRESENTATION, USERNAME_ORDER, VOTE_POLL_DURATION_LABEL } from '@renderer/constants/dpns'
import { UsernamePresentation } from '@renderer/enums/DashPay'
import type { RegisterGateInput } from '@renderer/types/DashPayUsernames'
import type { UsernameRowModel } from '@renderer/types/Dpns'
import { dashPayHref } from './dashPayIdentity'
import { creditShortfall } from './dashPayShortfall'
import { usernamePresentation, voteTiming } from './usernames'

export function usernameTitle(fullName: string): string {
  if (fullName.length <= USERNAME_TITLE_HEAD + USERNAME_TITLE_TAIL + USERNAME_TITLE_ELLIPSIS.length) return fullName
  return `${fullName.slice(0, USERNAME_TITLE_HEAD)}${USERNAME_TITLE_ELLIPSIS}${fullName.slice(-USERNAME_TITLE_TAIL)}`
}

export function primaryFirst(rows: UsernameRowModel[]): UsernameRowModel[] {
  return [...rows].sort((a, b) => USERNAME_ORDER.indexOf(a.presentation) - USERNAME_ORDER.indexOf(b.presentation)
    || Number(b.isPrimary) - Number(a.isPrimary))
}

export function registerUsernameHref(identifier: string, label: string | null): string {
  return dashPayHref(DASHPAY_ROUTES.registerUsername, identifier, { [DASHPAY_PARAMS.label]: label })
}

export function usernameTypeLabel(contested: boolean, network: Network | null): string {
  if (!contested) return USERNAME_TYPE_COPY.instant
  return network == null ? USERNAME_TYPE_COPY.contest : `${USERNAME_TYPE_COPY.contest} · ${VOTE_POLL_DURATION_LABEL[network]}`
}

export function balanceAfterFee(balance: bigint, fee: bigint | null): bigint | null {
  return fee == null ? null : balance - fee
}

export function registerCanAdvance(input: RegisterGateInput): boolean {
  return input.issue == null
    && input.canRegister
    && REGISTER_ALLOWED_AVAILABILITY.includes(input.availability)
    && input.feeReady
    && input.feeCredits != null
    && creditShortfall(input.balance, input.feeCredits) == null
}

export function registerDoneNote(
  username: Pick<UsernameDto, 'status' | 'voteEndsAt'>,
  network: Network | null,
  now: number,
): string {
  const presentation = usernamePresentation(username)
  if (presentation === UsernamePresentation.Registered) return REGISTER_SIGN_COPY.noteRegistered
  if (presentation !== UsernamePresentation.Voting) return USERNAME_PRESENTATION[presentation].caption
  if (username.voteEndsAt == null && network != null) return `${REGISTER_SIGN_COPY.noteContestLead} ${REGISTER_SIGN_COPY.noteContestEnds} ${VOTE_POLL_DURATION_LABEL[network]}.`
  return `${REGISTER_SIGN_COPY.noteContestLead} ${voteTiming(username.voteEndsAt, now)}.`
}
