import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import StatusPill from '@renderer/components/ui/StatusPill'
import { USERNAME_DETAIL_COPY, USERNAME_VOTE_FORMS } from '@renderer/constants/dashPayUsernames'
import { HIGHLIGHTED_IDENTIFIER_CLASS } from '@renderer/constants/identifier'
import { USERNAME_PRESENTATION } from '@renderer/constants/dpns'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { UsernamePresentation } from '@renderer/enums/DashPay'
import { ModalSize } from '@renderer/enums/ModalSize'
import type { ModalAction } from '@renderer/types/Modal'
import type { UsernameDetailLine, UsernameDetailModalProps } from '@renderer/types/DashPayUsernames'
import { countLabel } from '@renderer/utils/countLabel'
import { formatTimestamp } from '@renderer/utils/date'
import { usernameTitle, usernameTypeLabel } from '@renderer/utils/dashPayUsernames'
import { identityLabel } from '@renderer/utils/identifierFormat'
import { formatTimeLeft } from '@renderer/utils/timeLeft'
import { contestStandings, joinClosesAt, usernameCaption, voteOutcomeLabel } from '@renderer/utils/usernames'

function DetailLine({ label, value }: UsernameDetailLine): React.JSX.Element {
  return (
    <div className={"flex items-start justify-between gap-4"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{label}</Text>
      <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all text-right"}>{value}</Text>
    </div>
  )
}

export default function UsernameDetailModal({
  open,
  onClose,
  row,
  identity,
  now,
  network,
  onRegister,
}: UsernameDetailModalProps): React.JSX.Element | null {
  if (row == null) return null

  const spec = USERNAME_PRESENTATION[row.presentation]
  const username = row.username
  const voting = row.presentation === UsernamePresentation.Voting && username != null
  const closesAt = username != null && network != null ? joinClosesAt(username, network) : null
  const title = usernameTitle(row.fullName)

  const lines: UsernameDetailLine[] = [
    { label: USERNAME_DETAIL_COPY.identity, value: identityLabel(identity) },
    { label: USERNAME_DETAIL_COPY.type, value: usernameTypeLabel(row.isContested, network) },
  ]
  if (voting) {
    lines.push(
      { label: USERNAME_DETAIL_COPY.lock, value: String(username.votesLock ?? 0) },
      { label: USERNAME_DETAIL_COPY.abstain, value: String(username.votesAbstain ?? 0) },
    )
    if (username.voteEndsAt != null) {
      lines.push({ label: USERNAME_DETAIL_COPY.ends, value: `${formatTimestamp(new Date(username.voteEndsAt))} · ${formatTimeLeft(username.voteEndsAt, now)}` })
    }
    lines.push({
      label: USERNAME_DETAIL_COPY.newContenders,
      value: closesAt == null || closesAt <= now ? USERNAME_DETAIL_COPY.closed : formatTimestamp(new Date(closesAt)),
    })
  } else if (row.isContested && username?.voteEndsAt != null) {
    lines.push({ label: USERNAME_DETAIL_COPY.voteEnded, value: formatTimestamp(new Date(username.voteEndsAt)) })
  }
  const outcome = username == null ? null : voteOutcomeLabel(username)
  if (outcome != null) lines.push({ label: USERNAME_DETAIL_COPY.outcome, value: outcome })
  if (username?.voteWinner != null && username.voteWinner !== username.identifier) {
    lines.push({ label: USERNAME_DETAIL_COPY.winner, value: username.voteWinner })
  }
  const standings = username == null ? [] : contestStandings(username)

  const close: ModalAction = { label: USERNAME_DETAIL_COPY.close, onClick: onClose }
  let primary: ModalAction | null = null
  if (row.presentation === UsernamePresentation.Missing) {
    primary = { label: USERNAME_DETAIL_COPY.register, onClick: () => onRegister(row) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={usernameCaption(row, now) ?? spec.caption}
      size={ModalSize.Md}
    >
      <div className={`mt-5 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
        {title !== row.fullName && (
          <div className={"flex items-start justify-between gap-4"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{USERNAME_DETAIL_COPY.name}</Text>
            <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all text-right"}>{row.fullName}</Text>
          </div>
        )}
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{USERNAME_DETAIL_COPY.status}</Text>
          <StatusPill tone={spec.tone}>{spec.label}</StatusPill>
        </div>
        {lines.map(line => <DetailLine key={line.label} label={line.label} value={line.value} />)}
        {username?.documentId != null && (
          <div className={"flex items-start justify-between gap-4"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{USERNAME_DETAIL_COPY.documentId}</Text>
            <span className={"flex min-w-0 items-start gap-2"}>
              <HighlightedIdentifier className={`min-w-0 text-right text-xs! font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`}>{username.documentId}</HighlightedIdentifier>
              <CopyButton text={username.documentId} className={"shrink-0"} />
            </span>
          </div>
        )}
      </div>
      {standings.length > 0 && (
        <div className={`mt-3 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{USERNAME_DETAIL_COPY.contenders}</Text>
          {standings.map(standing => (
            <div key={standing.identifier} className={"flex items-start justify-between gap-4"}>
              <span className={"flex min-w-0 flex-col gap-0.5"}>
                <HighlightedIdentifier className={`min-w-0 text-left text-xs! font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`}>{standing.identifier}</HighlightedIdentifier>
                {standing.isOwn && <Text size={10} weight={"medium"} color={"blue-mint"}>{USERNAME_DETAIL_COPY.thisIdentity}</Text>}
              </span>
              <Text size={12} weight={"bold"} color={"brand"} className={"shrink-0 tabular-nums"}>{countLabel(standing.votes, USERNAME_VOTE_FORMS)}</Text>
            </div>
          ))}
        </div>
      )}
      <ModalActions primary={primary ?? close} secondary={primary == null ? undefined : close} />
    </Modal>
  )
}
