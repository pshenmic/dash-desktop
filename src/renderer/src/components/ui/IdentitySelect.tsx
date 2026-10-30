import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { ChevronIcon, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import { RefreshIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import SearchField from '@renderer/components/ui/SearchField'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import Spinner from '@renderer/components/ui/Spinner'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import { CONTACT_IDENTIFIER_CLASS } from '@renderer/constants/addressField'
import {
  IDENTITY_SELECT_COMPACT_IDENTIFIER_CLASS,
  IDENTITY_SELECT_COPY,
  IDENTITY_SELECT_HEADER_BASE,
  IDENTITY_SELECT_HEADER_WIDTH,
  IDENTITY_SELECT_NAVIGATION_KEYS,
  IDENTITY_SELECT_SEARCH_MIN,
  IDENTITY_SELECT_STYLES,
} from '@renderer/constants/identitySelect'
import { POPOVER, POPOVER_OPTION } from '@renderer/constants/surfaces'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { IdentitySelectAppearance } from '@renderer/enums/IdentitySelectAppearance'
import { ListNavigationKey } from '@renderer/enums/ListNavigationKey'
import type {
  IdentityMetaProps,
  IdentityNameProps,
  IdentitySelectPopoverProps,
  IdentitySelectProps,
} from '@renderer/types/IdentitySelect'
import { filterIdentities } from '@renderer/utils/dashPayIdentity'
import { identityLabel, identityName } from '@renderer/utils/identifierFormat'
import { nextListIndex } from '@renderer/utils/listNavigation'

function IdentityName({identity}: IdentityNameProps): React.JSX.Element {
  const name = identityName(identity)
  if (name != null) {
    return <Text size={14} weight={"medium"} color={"brand"} className={"break-all text-left"}>{name}</Text>
  }
  return <HighlightedIdentifier className={CONTACT_IDENTIFIER_CLASS}>{identity.identifier}</HighlightedIdentifier>
}

function IdentityHeadline({identity}: IdentityNameProps): React.JSX.Element {
  const name = identityName(identity)
  const extraNames = name == null ? 0 : Math.max(0, identity.usernames.length - 1)
  return (
    <span className={'flex min-w-0 items-center gap-1.5'}>
      {name == null
        ? <HighlightedIdentifier className={IDENTITY_SELECT_COMPACT_IDENTIFIER_CLASS}>{identity.identifier}</HighlightedIdentifier>
        : <Text reset size={14} weight={'medium'} color={'brand'} className={'min-w-0 truncate leading-[130%]'}>{name}</Text>}
      {extraNames > 0 && <CustomBadge variant={'muted'} text={`+${extraNames}`} className={'shrink-0'} />}
    </span>
  )
}

function IdentityMeta({identity, meta, warnEmpty = false}: IdentityMetaProps): React.JSX.Element {
  const { isBalanceVisible } = useBalanceVisibility()
  return (
    <span className={'block min-w-0 truncate text-[0.625rem] font-medium leading-[130%] text-dash-primary-dark-blue/50 dark:text-white/50'}>
      <span className={warnEmpty && identity.balance.amount === 0n ? 'text-dash-orange' : ''}>
        <SensitiveValue hidden={!isBalanceVisible} size={'subtext'}>
          <CreditsAmount credits={identity.balance.amount} compact showFiat={false} />
        </SensitiveValue>
      </span>
      {meta != null && <> · {meta}</>}
    </span>
  )
}

export function IdentitySelectPopover({
  appearance,
  identities,
  selected,
  searchable,
  activateSelected,
  renderMeta,
  renderBadge,
  footer,
  onSelect,
  onDismiss,
}: IdentitySelectPopoverProps): React.JSX.Element {
  const styles = IDENTITY_SELECT_STYLES[appearance]
  const header = appearance === IdentitySelectAppearance.Header
  const showSearch = searchable && identities.length >= IDENTITY_SELECT_SEARCH_MIN
  const framed = header || showSearch || footer != null
  const [query, setQuery] = useState('')
  const visible = showSearch ? filterIdentities(identities, query) : identities
  const [active, setActive] = useState(() => activateSelected ? identities.findIndex(identity => identity.identifier === selected?.identifier) : -1)
  const baseId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionId = (index: number): string => `${baseId}-option-${index}`

  useEffect(() => {
    if (!showSearch) listRef.current?.focus()
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [])

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const changeQuery = (value: string): void => {
    setQuery(value)
    setActive(-1)
  }

  const handlePopoverKey = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onDismiss(true)
    } else if (event.key === 'Tab') {
      onDismiss(false)
    }
  }

  const handleListKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (IDENTITY_SELECT_NAVIGATION_KEYS.includes(event.key)) {
      event.preventDefault()
      setActive(nextListIndex(active, event.key, visible.length))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const identity = visible[active]
      if (identity) onSelect(identity.identifier)
      return
    }
    if (showSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      searchRef.current?.focus()
      return
    }
    if (!framed) handlePopoverKey(event)
  }

  const handleSearchKey = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === ListNavigationKey.ArrowDown) {
      event.preventDefault()
      if (visible.length === 0) return
      setActive(0)
      listRef.current?.focus()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (visible[0]) onSelect(visible[0].identifier)
    }
  }

  const activeDescendant = active >= 0 && active < visible.length ? optionId(active) : undefined

  const options = visible.map((identity, index) => {
    const isSelected = identity.identifier === selected?.identifier
    const meta = renderMeta?.(identity)
    const badge = renderBadge?.(identity)
    return (
      <button
        key={identity.identifier}
        id={optionId(index)}
        type={"button"}
        role={"option"}
        aria-selected={isSelected}
        tabIndex={-1}
        onClick={() => onSelect(identity.identifier)}
        className={`${styles.option} ${POPOVER_OPTION} ${isSelected ? 'dash-block-accent-5' : ''}${index === active ? ' dash-block-accent-10' : ''}`}
      >
        {header ? (
          <>
            <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Xs} />
            <span className={'flex min-w-0 flex-col gap-0.5'}>
              <IdentityHeadline identity={identity} />
              <IdentityMeta identity={identity} meta={meta} />
            </span>
            {badge}
          </>
        ) : (
          <>
            {badge == null ? <IdentityName identity={identity} /> : (
              <span className={'flex w-full items-start justify-between gap-2'}>
                <IdentityName identity={identity} />
                {badge}
              </span>
            )}
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
              <CreditsAmount credits={identity.balance.amount} />
              {meta != null && <> · {meta}</>}
            </Text>
          </>
        )}
      </button>
    )
  })

  if (!framed) {
    return (
      <div
        ref={listRef}
        role={"listbox"}
        tabIndex={-1}
        aria-label={IDENTITY_SELECT_COPY.identities}
        aria-activedescendant={activeDescendant}
        onKeyDown={handleListKey}
        className={`${styles.popover} ${styles.list} ${POPOVER} outline-none`}
      >
        {options}
      </div>
    )
  }

  return (
    <div onKeyDown={handlePopoverKey} className={`${styles.popover} flex flex-col gap-1 ${POPOVER}`}>
      {header && (
        <Text reset size={10} weight={'medium'} color={'brand'} opacity={40} className={'block uppercase tracking-[.08em] px-[.625rem] py-1'}>
          {`${IDENTITY_SELECT_COPY.actAs} · ${identities.length}`}
        </Text>
      )}
      {showSearch && (
        <SearchField
          ref={searchRef}
          autoFocus
          value={query}
          onChange={changeQuery}
          onKeyDown={handleSearchKey}
          placeholder={IDENTITY_SELECT_COPY.searchPlaceholder}
          ariaLabel={IDENTITY_SELECT_COPY.searchLabel}
        />
      )}
      {visible.length > 0 ? (
        <div
          ref={listRef}
          role={"listbox"}
          tabIndex={-1}
          aria-label={IDENTITY_SELECT_COPY.identities}
          aria-activedescendant={activeDescendant}
          onKeyDown={handleListKey}
          className={`${styles.list} flex flex-col outline-none`}
        >
          {options}
        </div>
      ) : (
        <Text reset as={'p'} size={12} weight={'medium'} color={'brand'} opacity={50} className={'py-4 text-center'}>
          {`${IDENTITY_SELECT_COPY.noMatch} "${query}"`}
        </Text>
      )}
      {footer != null && (
        <>
          <div className={'h-px bg-dash-primary-dark-blue/8 dark:bg-white/8'} />
          <div onClick={() => onDismiss(false)}>{footer}</div>
        </>
      )}
    </div>
  )
}

export default function IdentitySelect({
  identities,
  loading,
  error,
  selected,
  onSelect,
  onRetry,
  appearance = IdentitySelectAppearance.Field,
  searchable = false,
  renderMeta,
  renderTriggerMeta,
  renderBadge,
  footer,
  attention = false,
  ariaLabel,
  ref,
}: IdentitySelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [activateSelected, setActivateSelected] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useClickOutside(rootRef, () => setOpen(false))

  const header = appearance === IdentitySelectAppearance.Header
  const styles = IDENTITY_SELECT_STYLES[appearance]
  const reload = Boolean(error) || identities.length === 0
  const isStatic = header && identities.length === 1 && !loading && !error
  const canOpen = !loading && !reload && !isStatic

  const show = (keyboard: boolean): void => {
    if (!canOpen) return
    setActivateSelected(keyboard)
    setOpen(true)
  }

  useImperativeHandle(ref, () => ({ open: () => show(true) }))

  const close = (restoreFocus: boolean): void => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const choose = (identifier: string): void => {
    onSelect(identifier)
    close(true)
  }

  if (header && loading) {
    return <div role={'status'} aria-label={IDENTITY_SELECT_COPY.loading} className={`h-12 ${IDENTITY_SELECT_HEADER_WIDTH} rounded-[.9375rem] animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8`} />
  }

  const headerContent = (identity: IdentityApiDto): React.JSX.Element => (
    <>
      <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Sm} />
      <span className={'flex min-w-0 flex-1 flex-col gap-1 text-left'}>
        <IdentityHeadline identity={identity} />
        <IdentityMeta identity={identity} meta={renderTriggerMeta?.(identity)} warnEmpty />
      </span>
    </>
  )

  const headerWidth = (identity: IdentityApiDto | undefined): string =>
    identity != null && identityName(identity) == null ? 'w-max min-w-[17.5rem]' : IDENTITY_SELECT_HEADER_WIDTH

  if (isStatic) {
    const shown = selected ?? identities[0]
    return <div className={`${IDENTITY_SELECT_HEADER_BASE} ${headerWidth(shown)}`}>{headerContent(shown)}</div>
  }

  let content: React.JSX.Element
  if (selected) {
    content = header ? headerContent(selected) : (
      <div className={"flex flex-col items-start min-w-0"}>
        <IdentityName identity={selected} />
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          <CreditsAmount credits={selected.balance.amount} showFiat={false} />
        </Text>
      </div>
    )
  } else {
    const message = loading || error ? IDENTITY_SELECT_COPY.identities : IDENTITY_SELECT_COPY.empty
    content = header
      ? <Text reset size={14} weight={'medium'} color={'brand'} opacity={50} className={'min-w-0 flex-1 truncate pl-1.5 text-left'}>{message}</Text>
      : <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{message}</Text>
  }

  let action: React.JSX.Element | null = null
  if (loading) {
    action = <span role="status" aria-label={IDENTITY_SELECT_COPY.loading}><Spinner size={14} className="dash-text-primary" /></span>
  } else if (reload) {
    action = <RefreshIcon size={14} color="currentColor" className="dash-text-primary" />
  } else {
    action = (
      <>
        {header && attention && <span className={'size-1.5 shrink-0 rounded-full bg-dash-orange'} />}
        <ChevronIcon
          size={12}
          color="currentColor"
          className={`shrink-0 dash-text-default transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </>
    )
  }

  let label: string = ariaLabel ?? IDENTITY_SELECT_COPY.select
  if (reload) {
    label = IDENTITY_SELECT_COPY.reload
  } else if (header && ariaLabel == null && selected) {
    label = `${IDENTITY_SELECT_COPY.actingIdentity}: ${identityLabel(selected)}. ${IDENTITY_SELECT_COPY.change}${attention ? `. ${IDENTITY_SELECT_COPY.attention}` : ''}`
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (reload) {
      if (!loading) onRetry()
      return
    }
    if (open) {
      setOpen(false)
      return
    }
    show(event.detail === 0)
  }

  const handleTriggerKey = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== ListNavigationKey.ArrowDown || open || !canOpen) return
    event.preventDefault()
    show(true)
  }

  return (
    <div className={"relative"} ref={rootRef}>
      <button
        ref={triggerRef}
        type={"button"}
        aria-label={label}
        aria-busy={loading}
        aria-haspopup={"listbox"}
        aria-expanded={open}
        disabled={loading}
        onClick={handleClick}
        onKeyDown={handleTriggerKey}
        className={header ? `${styles.trigger} ${headerWidth(selected)}` : styles.trigger}
      >
        {content}
        {action}
      </button>

      {open && canOpen && (
        <IdentitySelectPopover
          appearance={appearance}
          identities={identities}
          selected={selected}
          searchable={searchable}
          activateSelected={activateSelected}
          renderMeta={renderMeta}
          renderBadge={renderBadge}
          footer={footer}
          onSelect={choose}
          onDismiss={close}
        />
      )}
    </div>
  )
}
