import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import StatusPill from '@renderer/components/ui/StatusPill'
import { USERNAME_DETAIL_COPY, USERNAME_DOCUMENT_ID_CLASS } from '@renderer/constants/dashPayUsernames'
import { ALIAS_PRESENTATION } from '@renderer/constants/dpns'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { AliasPresentation } from '@renderer/enums/DashPay'
import { ModalSize } from '@renderer/enums/ModalSize'
import type { ModalAction } from '@renderer/types/Modal'
import type { UsernameDetailLine, UsernameDetailModalProps } from '@renderer/types/DashPayUsernames'
import { formatTimestamp } from '@renderer/utils/date'
import { usernameTitle, usernameTypeLabel } from '@renderer/utils/dashPayUsernames'
import { identityLabel } from '@renderer/utils/identifierFormat'
import { formatAgo, formatTimeLeft } from '@renderer/utils/timeLeft'
import { joinClosesAt, usernameCaption } from '@renderer/utils/usernames'

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
  onViewContest,
}: UsernameDetailModalProps): React.JSX.Element | null {
  if (row == null) return null

  const spec = ALIAS_PRESENTATION[row.presentation]
  const alias = row.alias
  const voting = row.presentation === AliasPresentation.Voting && alias != null
  const closesAt = alias != null && network != null ? joinClosesAt(alias, network) : null
  const title = usernameTitle(row.fullName)

  const lines: UsernameDetailLine[] = [
    { label: USERNAME_DETAIL_COPY.identity, value: identityLabel(identity) },
    { label: USERNAME_DETAIL_COPY.type, value: usernameTypeLabel(row.isContested, network) },
  ]
  if (alias != null) lines.push({ label: USERNAME_DETAIL_COPY.added, value: formatTimestamp(new Date(alias.createdAt)) })
  if (alias?.checkedAt != null) lines.push({ label: USERNAME_DETAIL_COPY.checked, value: formatAgo(alias.checkedAt, now) })
  if (voting) {
    lines.push(
      { label: USERNAME_DETAIL_COPY.forYou, value: String(alias.votesFor ?? 0) },
      { label: USERNAME_DETAIL_COPY.lock, value: String(alias.votesLock ?? 0) },
      { label: USERNAME_DETAIL_COPY.abstain, value: String(alias.votesAbstain ?? 0) },
    )
    if (alias.voteEndsAt != null) {
      lines.push({ label: USERNAME_DETAIL_COPY.ends, value: `${formatTimestamp(new Date(alias.voteEndsAt))} · ${formatTimeLeft(alias.voteEndsAt, now)}` })
    }
    lines.push({
      label: USERNAME_DETAIL_COPY.newContenders,
      value: closesAt == null || closesAt <= now ? USERNAME_DETAIL_COPY.closed : formatTimestamp(new Date(closesAt)),
    })
  } else if (row.isContested && alias?.voteEndsAt != null) {
    lines.push({ label: USERNAME_DETAIL_COPY.voteEnded, value: formatTimestamp(new Date(alias.voteEndsAt)) })
  }

  const close: ModalAction = { label: USERNAME_DETAIL_COPY.close, onClick: onClose }
  let primary: ModalAction | null = null
  if (voting && onViewContest != null) {
    primary = { label: USERNAME_DETAIL_COPY.viewContest, onClick: () => onViewContest(row) }
  } else if (row.presentation === AliasPresentation.Resumable) {
    primary = { label: USERNAME_DETAIL_COPY.resume, onClick: () => onRegister(row) }
  } else if (row.presentation === AliasPresentation.Missing) {
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
          <StatusPill tone={spec.tone} loading={row.presentation === AliasPresentation.Pending}>{spec.label}</StatusPill>
        </div>
        {lines.map(line => <DetailLine key={line.label} label={line.label} value={line.value} />)}
        {alias?.documentId != null && (
          <div className={"flex items-start justify-between gap-4"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{USERNAME_DETAIL_COPY.documentId}</Text>
            <span className={"flex min-w-0 items-start gap-2"}>
              <HighlightedIdentifier className={USERNAME_DOCUMENT_ID_CLASS}>{alias.documentId}</HighlightedIdentifier>
              <CopyButton text={alias.documentId} className={"shrink-0"} />
            </span>
          </div>
        )}
      </div>
      {voting && (
        <Text reset as={"p"} size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-3"}>
          {USERNAME_DETAIL_COPY.votesNote}
        </Text>
      )}
      <ModalActions primary={primary ?? close} secondary={primary == null ? undefined : close} />
    </Modal>
  )
}
