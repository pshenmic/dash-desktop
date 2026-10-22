import { useRef } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import ReadinessAlert from '@renderer/components/pages/dashpay/keys/ReadinessAlert'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import FadingScrollArea from '@renderer/components/ui/FadingScrollArea'
import IdentitySelect from '@renderer/components/ui/IdentitySelect'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { DASHPAY_READINESS_BADGES } from '@renderer/constants/dashPay'
import {
  ADD_CONTACT_COPY,
  ADD_CONTACT_LIST_CLASS,
  ADD_CONTACT_LIST_HEIGHT_CLASS,
  ADD_CONTACT_LIST_HEIGHT_WITH_ALERT_CLASS,
  ADD_CONTACT_PANEL_NOTE_CLASS,
  ADD_CONTACT_SKELETON_ROW_CLASS,
  ADD_CONTACT_SKELETON_ROWS,
} from '@renderer/constants/dashPayAddContact'
import { IDENTITY_SELECT_NAVIGATION_KEYS } from '@renderer/constants/identitySelect'
import { SEARCH_FIELD_LARGE_CLASS } from '@renderer/constants/listToolbar'
import { DashPayReadiness } from '@renderer/enums/DashPay'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { FindStepProps } from '@renderer/types/DashPayAddContact'
import { isSelectableResult } from '@renderer/utils/dashPayAddContact'
import { dashPayReadiness } from '@renderer/utils/dashPayReadiness'
import { nextListIndex } from '@renderer/utils/listNavigation'
import SearchResultRow from './SearchResultRow'

function readinessBadge(identity: IdentityApiDto): React.JSX.Element {
  const badge = DASHPAY_READINESS_BADGES[dashPayReadiness(identity).readiness]
  return <CustomBadge variant={badge.variant} text={badge.text} className={"shrink-0"} />
}

export default function FindStep({
  identities,
  identity,
  readiness,
  identitiesLoading,
  identitiesError,
  onRetryIdentities,
  onSelectIdentity,
  selectRef,
  onEnable,
  onSwitchIdentity,
  query,
  onQueryChange,
  search,
  selectedId,
  onSelectRow,
  onOpenContact,
  onAccept,
}: FindStepProps): React.JSX.Element {
  const groupRef = useRef<HTMLDivElement>(null)
  const selectable = search.rows.filter(row => isSelectableResult(row.state))
  const focusId = selectable.some(row => row.identifier === selectedId) ? selectedId : selectable[0]?.identifier ?? null

  const handleGroupKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!IDENTITY_SELECT_NAVIGATION_KEYS.includes(event.key) || selectable.length === 0) return
    event.preventDefault()
    const current = selectable.findIndex(row => row.identifier === focusId)
    const next = selectable[nextListIndex(current, event.key, selectable.length)]
    if (next == null) return
    onSelectRow(next.identifier)
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-identifier="${next.identifier}"]`)?.focus()
  }

  const listHeight = readiness.readiness === DashPayReadiness.Ready ? ADD_CONTACT_LIST_HEIGHT_CLASS : ADD_CONTACT_LIST_HEIGHT_WITH_ALERT_CLASS

  let panel: React.JSX.Element
  if (query.trim() === '') {
    panel = (
      <Text reset as={"p"} size={12} weight={"medium"} color={"brand"} opacity={50} className={"py-12 text-center"}>
        {ADD_CONTACT_COPY.idle}
      </Text>
    )
  } else if (search.err != null) {
    panel = <NoResults tone={NoResultsTone.Error} noResults={search.err} action={<RetryButton onRetry={search.retry} />} />
  } else if (search.loading) {
    panel = <ListSkeleton rows={ADD_CONTACT_SKELETON_ROWS} rowClassName={ADD_CONTACT_SKELETON_ROW_CLASS} />
  } else if (search.rows.length === 0) {
    panel = <NoResults noResults={`${ADD_CONTACT_COPY.noMatch} "${query.trim()}"`} />
  } else {
    panel = (
      <div className={"flex flex-col gap-2"}>
        <Text reset size={10} weight={"medium"} color={"brand"} opacity={50} className={`${ADD_CONTACT_PANEL_NOTE_CLASS} truncate`}>
          {`${ADD_CONTACT_COPY.resultsFor} "${query.trim()}" · ${search.rows.length}`}
        </Text>
        <FadingScrollArea className={`${ADD_CONTACT_LIST_CLASS} ${listHeight}`}>
          <div
            ref={groupRef}
            role={"radiogroup"}
            aria-label={ADD_CONTACT_COPY.resultsLabel}
            onKeyDown={handleGroupKey}
            className={"flex flex-col gap-[.625rem]"}
          >
            {search.rows.map(row => (
              <SearchResultRow
                key={row.identifier}
                row={row}
                checked={row.identifier === selectedId}
                focusable={row.identifier === focusId}
                acceptDisabled={!readiness.canSend}
                onSelect={onSelectRow}
                onOpenContact={onOpenContact}
                onAccept={onAccept}
              />
            ))}
          </div>
        </FadingScrollArea>
        {search.capped && (
          <Text reset size={10} weight={"medium"} color={"brand"} opacity={50} className={ADD_CONTACT_PANEL_NOTE_CLASS}>
            {ADD_CONTACT_COPY.capped}
          </Text>
        )}
      </div>
    )
  }

  return (
    <>
      <div className={"flex flex-col gap-2.5"}>
        <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{ADD_CONTACT_COPY.fromIdentity}</Text>
        <IdentitySelect
          ref={selectRef}
          identities={identities}
          loading={identitiesLoading}
          error={identitiesError}
          selected={identity}
          onSelect={onSelectIdentity}
          onRetry={onRetryIdentities}
          searchable
          renderBadge={readinessBadge}
          ariaLabel={ADD_CONTACT_COPY.fromIdentity}
        />
      </div>
      <ReadinessAlert identity={identity} readiness={readiness} onEnable={onEnable} onSwitchIdentity={onSwitchIdentity} />
      <SearchField
        autoFocus
        value={query}
        onChange={onQueryChange}
        placeholder={ADD_CONTACT_COPY.searchPlaceholder}
        ariaLabel={ADD_CONTACT_COPY.searchLabel}
        inputClassName={SEARCH_FIELD_LARGE_CLASS}
      />
      {panel}
    </>
  )
}
