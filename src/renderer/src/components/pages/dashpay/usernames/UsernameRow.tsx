import { Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import StatusPill from '@renderer/components/ui/StatusPill'
import { DASHPAY_CONTACT_ROW_CLASS } from '@renderer/constants/dashPay'
import { USERNAME_LIST_COPY } from '@renderer/constants/dashPayUsernames'
import { USERNAME_PRESENTATION, DPNS_NAME_SUFFIX } from '@renderer/constants/dpns'
import { ROW_OPEN_OVERLAY_CLASS } from '@renderer/constants/listToolbar'
import { CHIP_ACTION, ICON_CHIP } from '@renderer/constants/surfaces'
import { UsernamePresentation } from '@renderer/enums/DashPay'
import type { UsernameRowProps } from '@renderer/types/DashPayUsernames'
import { usernameCaption } from '@renderer/utils/usernames'

export default function UsernameRow({ row, now, onOpen, onRegister }: UsernameRowProps): React.JSX.Element {
  const spec = USERNAME_PRESENTATION[row.presentation]
  const caption = usernameCaption(row, now)
  const registered = row.presentation === UsernamePresentation.Registered

  let action: React.JSX.Element | null = null
  if (registered) {
    action = <CopyButton text={row.fullName} />
  } else if (row.presentation === UsernamePresentation.Missing) {
    action = (
      <button type={"button"} className={CHIP_ACTION} onClick={() => onRegister(row)}>
        {USERNAME_LIST_COPY.registerAgain}
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
      <span aria-hidden={"true"} className={registered ? ICON_CHIP : 'flex size-[1.875rem] shrink-0 items-center justify-center rounded-full dash-block-5 opacity-50'}>
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
        <StatusPill tone={spec.tone}>{spec.label}</StatusPill>
        {action}
      </div>
    </li>
  )
}
