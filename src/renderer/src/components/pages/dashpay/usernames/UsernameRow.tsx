import { Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import StatusPill from '@renderer/components/ui/StatusPill'
import { DASHPAY_CONTACT_ROW_CLASS } from '@renderer/constants/dashPay'
import { USERNAME_LINK_CLASS, USERNAME_LIST_COPY, USERNAME_MONOGRAM_MUTED_CLASS } from '@renderer/constants/dashPayUsernames'
import { ALIAS_PRESENTATION, DPNS_NAME_SUFFIX } from '@renderer/constants/dpns'
import { ROW_OPEN_OVERLAY_CLASS } from '@renderer/constants/listToolbar'
import { CHIP_ACTION, ICON_CHIP } from '@renderer/constants/surfaces'
import { AliasPresentation } from '@renderer/enums/DashPay'
import type { UsernameRowProps } from '@renderer/types/DashPayUsernames'
import { usernameCaption } from '@renderer/utils/usernames'

export default function UsernameRow({ row, now, onOpen, onRegister, onViewContest }: UsernameRowProps): React.JSX.Element {
  const spec = ALIAS_PRESENTATION[row.presentation]
  const caption = usernameCaption(row, now)
  const registered = row.presentation === AliasPresentation.Registered

  let action: React.JSX.Element | null = null
  if (registered) {
    action = <CopyButton text={row.fullName} />
  } else if (row.presentation === AliasPresentation.Voting && onViewContest != null) {
    action = (
      <button type={"button"} className={USERNAME_LINK_CLASS} onClick={() => onViewContest(row)}>
        <Text size={12} weight={"medium"} color={"blue-mint"} className={"whitespace-nowrap"}>{USERNAME_LIST_COPY.viewContest}</Text>
      </button>
    )
  } else if (row.presentation === AliasPresentation.Resumable || row.presentation === AliasPresentation.Missing) {
    action = (
      <button type={"button"} className={CHIP_ACTION} onClick={() => onRegister(row)}>
        {row.presentation === AliasPresentation.Resumable ? USERNAME_LIST_COPY.resume : USERNAME_LIST_COPY.registerAgain}
      </button>
    )
  }

  return (
    <li className={DASHPAY_CONTACT_ROW_CLASS}>
      <button
        type={"button"}
        className={ROW_OPEN_OVERLAY_CLASS}
        aria-label={`${USERNAME_LIST_COPY.open} ${row.fullName}`}
        onClick={() => onOpen(row)}
      />
      <span aria-hidden={"true"} className={registered ? ICON_CHIP : USERNAME_MONOGRAM_MUTED_CLASS}>
        <Text reset size={12} weight={"bold"} className={"uppercase text-inherit!"}>{row.label.charAt(0)}</Text>
      </span>
      <div className={"flex min-w-0 flex-col gap-0.5"}>
        <div className={"flex min-w-0 items-center gap-1.5"}>
          <Text reset size={14} weight={"medium"} color={"brand"} className={"min-w-0 truncate leading-[130%]"}>
            {row.label}<span className={"opacity-50"}>{DPNS_NAME_SUFFIX}</span>
          </Text>
          {row.isPrimary && (
            <Tooltip label={USERNAME_LIST_COPY.primaryTooltip}>
              <span className={"relative z-10 inline-flex shrink-0"}>
                <CustomBadge text={USERNAME_LIST_COPY.primary} />
              </span>
            </Tooltip>
          )}
          {row.isContested && <CustomBadge variant={"muted"} text={USERNAME_LIST_COPY.contested} className={"shrink-0"} />}
        </div>
        {caption != null && (
          <Text reset size={10} weight={"medium"} color={"brand"} opacity={50} className={"min-w-0 truncate"}>{caption}</Text>
        )}
      </div>
      <div className={"relative z-10 flex items-center gap-3"}>
        <StatusPill tone={spec.tone} loading={row.presentation === AliasPresentation.Pending}>{spec.label}</StatusPill>
        {action}
      </div>
    </li>
  )
}
