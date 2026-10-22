import { Text, Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import {
  ADD_CONTACT_CHIP_CLASS,
  ADD_CONTACT_COPY,
  ADD_CONTACT_RADIO_CHECKED_CLASS,
  ADD_CONTACT_RADIO_CLASS,
  ADD_CONTACT_RADIO_PLACEHOLDER_CLASS,
  ADD_CONTACT_ROW_CHECKED_CLASS,
  ADD_CONTACT_ROW_CLASS,
  ADD_CONTACT_ROW_DIMMED_CLASS,
  ADD_CONTACT_ROW_SELECTABLE_CLASS,
  DIMMED_SEARCH_RESULT_STATES,
  SEARCH_RESULT_BADGES,
} from '@renderer/constants/dashPayAddContact'
import { ROW_OPEN_OVERLAY_CLASS } from '@renderer/constants/listToolbar'
import { SearchResultState } from '@renderer/enums/DashPay'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import type { SearchResultRowProps } from '@renderer/types/DashPayAddContact'
import { isSelectableResult, resultRowLabel } from '@renderer/utils/dashPayAddContact'
import { shortIdentifier } from '@renderer/utils/identifierFormat'

export default function SearchResultRow({
  row,
  checked,
  focusable,
  acceptDisabled,
  onSelect,
  onOpenContact,
  onAccept,
}: SearchResultRowProps): React.JSX.Element {
  const selectable = isSelectableResult(row.state)
  const badge = SEARCH_RESULT_BADGES[row.state]
  const label = resultRowLabel(row)
  const stateClass = [
    selectable ? ADD_CONTACT_ROW_SELECTABLE_CLASS : '',
    checked ? ADD_CONTACT_ROW_CHECKED_CLASS : '',
    DIMMED_SEARCH_RESULT_STATES.has(row.state) ? ADD_CONTACT_ROW_DIMMED_CLASS : '',
  ].join(' ')

  return (
    <div className={`${ADD_CONTACT_ROW_CLASS} ${stateClass}`}>
      {selectable && (
        <button
          type={"button"}
          role={"radio"}
          aria-checked={checked}
          aria-label={label}
          tabIndex={focusable ? 0 : -1}
          data-identifier={row.identifier}
          onClick={() => onSelect(row.identifier)}
          className={ROW_OPEN_OVERLAY_CLASS}
        />
      )}
      <span className={"pointer-events-none flex justify-center"}>
        <span className={selectable ? `${ADD_CONTACT_RADIO_CLASS} ${checked ? ADD_CONTACT_RADIO_CHECKED_CLASS : ''}` : ADD_CONTACT_RADIO_PLACEHOLDER_CLASS} />
      </span>
      <span className={"pointer-events-none flex"}>
        <IdentityAvatar identifier={row.identifier} size={IdentityAvatarSize.Sm} />
      </span>
      <span className={"pointer-events-none flex min-w-0 flex-col gap-0.5"}>
        <span className={"flex min-w-0 items-center gap-1.5"}>
          <Text reset size={14} weight={"medium"} color={"brand"} className={"min-w-0 truncate leading-[130%]"}>{label}</Text>
          {row.extraNames > 0 && <CustomBadge variant={"muted"} text={`+${row.extraNames}`} className={"shrink-0"} />}
        </span>
        <Text reset size={10} weight={"medium"} color={"brand"} opacity={50} className={"truncate leading-[130%]"}>
          {row.name == null ? ADD_CONTACT_COPY.noUsername : shortIdentifier(row.identifier)}
        </Text>
      </span>
      <span className={"relative z-10 flex items-center gap-2"}>
        {badge && <CustomBadge variant={badge.variant} text={badge.text} className={"shrink-0"} />}
        {row.state === SearchResultState.Contact && (
          <button type={"button"} className={ADD_CONTACT_CHIP_CLASS} onClick={() => onOpenContact(row.identifier)}>
            {ADD_CONTACT_COPY.open}
          </button>
        )}
        {row.state === SearchResultState.Incoming && (
          <Tooltip label={acceptDisabled ? ADD_CONTACT_COPY.enableFirst : undefined}>
            <span className={"inline-flex"}>
              <button type={"button"} disabled={acceptDisabled} className={ADD_CONTACT_CHIP_CLASS} onClick={() => onAccept(row.identifier)}>
                {ADD_CONTACT_COPY.accept}
              </button>
            </span>
          </Tooltip>
        )}
      </span>
    </div>
  )
}
