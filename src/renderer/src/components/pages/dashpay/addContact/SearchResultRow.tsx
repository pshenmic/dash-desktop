import { HighlightedIdentifier, Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import { CONTACT_IDENTIFIER_CLASS } from '@renderer/constants/addressField'
import {
  ADD_CONTACT_CHIP_CLASS,
  ADD_CONTACT_COPY,
  DIMMED_SEARCH_RESULT_STATES,
  SEARCH_RESULT_BADGES,
} from '@renderer/constants/dashPayAddContact'
import { SURFACE_ROW } from '@renderer/constants/surfaces'
import { ROW_OPEN_OVERLAY_CLASS } from '@renderer/constants/listToolbar'
import { SearchResultState } from '@renderer/enums/DashPay'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import type { SearchResultRowProps } from '@renderer/types/DashPayAddContact'
import { isSelectableResult, resultRowLabel } from '@renderer/utils/dashPayAddContact'

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
    selectable ? 'hover:border-dash-brand/50 dark:hover:border-dash-mint/50' : '',
    checked ? 'border-dash-brand! dark:border-dash-mint! bg-dash-brand/6! dark:bg-dash-mint/6!' : '',
    DIMMED_SEARCH_RESULT_STATES.has(row.state) ? 'opacity-40' : '',
  ].join(' ')

  return (
    <div className={`relative grid grid-cols-[1rem_2rem_minmax(0,1fr)_auto] items-center gap-3 min-h-13 border border-transparent ${SURFACE_ROW} transition-colors ${stateClass}`}>
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
        <span className={selectable ? `size-4 shrink-0 rounded-full border-2 border-dash-primary-dark-blue/30 dark:border-white/30 ${checked ? 'border-[5px]! border-dash-brand! dark:border-dash-mint!' : ''}` : 'block h-0.5 w-2.5 rounded-full bg-dash-primary-dark-blue/30 dark:bg-white/30'} />
      </span>
      <span className={"pointer-events-none flex"}>
        <IdentityAvatar identifier={row.identifier} size={IdentityAvatarSize.Sm} />
      </span>
      <span className={"pointer-events-none flex min-w-0 flex-col gap-0.5"}>
        <span className={"flex min-w-0 items-center gap-1.5"}>
          {row.name != null ? (
            <Text reset size={14} weight={"medium"} color={"brand"} className={"min-w-0 truncate leading-[130%]"}>{row.name}</Text>
          ) : (
            <HighlightedIdentifier className={CONTACT_IDENTIFIER_CLASS}>{row.identifier}</HighlightedIdentifier>
          )}
          {row.extraNames > 0 && <CustomBadge variant={"muted"} text={`+${row.extraNames}`} className={"shrink-0"} />}
        </span>
        {row.name != null ? (
          <Text reset size={10} weight={"medium"} color={"brand"} opacity={50} className={"break-all leading-[130%]"}>{row.identifier}</Text>
        ) : (
          <Text reset size={10} weight={"medium"} color={"brand"} opacity={50} className={"truncate leading-[130%]"}>{ADD_CONTACT_COPY.noUsername}</Text>
        )}
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
