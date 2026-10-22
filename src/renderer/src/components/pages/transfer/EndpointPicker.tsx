import { useRef, useState } from "react";
import { Text, ChevronIcon, CreditsIcon, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { PlatformAddressDto } from "@renderer/api/types";
import { IdentityApiDto } from "@renderer/hooks/useIdentities";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import LayerBadge from "@renderer/components/ui/LayerBadge";
import { SOURCE_KINDS } from "@renderer/utils/transferMatrix";
import { endpointKindOptions } from "@renderer/utils/endpointKindOptions";
import { SourceKind } from "@renderer/enums/SourceKind";
import { DestinationKind } from "@renderer/enums/DestinationKind";
import { Identifier } from "dash-ui-kit/react";
import { ADDRESS_INPUT, ADDRESS_INPUT_TEXT_SIZES, CONTACT_IDENTIFIER_CLASS, FIELD_INVALID } from "@renderer/constants/addressField";
import { FIELD_COMPACT, POPOVER, POPOVER_OPTION } from "@renderer/constants/surfaces";
import PlatformAddressSelect from "./PlatformAddressSelect";
import DropdownField from "@renderer/components/ui/DropdownField";
import type { DestinationPickerProps, EndpointKindEntry } from "@renderer/types/EndpointPicker";
import Spinner from "@renderer/components/ui/Spinner";
import { RefreshIcon } from "@renderer/components/dash-ui-kit-enxtended/icons";

function KindIcon({kind}: {kind: string}): React.JSX.Element {
  if (kind === SourceKind.Core || kind === DestinationKind.CoreAddress) return <LayerBadge layer={'L1'} />
  if (kind === SourceKind.PlatformAddress) return <LayerBadge layer={'L2'} />
  if (kind === SourceKind.Shielded) return <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
  return <CreditsIcon size={16} />
}

interface KindDropdownProps {
  kinds: EndpointKindEntry[]
  selected: string
  onSelect: (kind: string) => void
}

function KindDropdown({kinds, selected, onSelect}: KindDropdownProps): React.JSX.Element {
  return (
    <DropdownField
      options={endpointKindOptions(kinds)}
      value={selected}
      onChange={onSelect}
      ariaLabel="Select transfer type"
      triggerClassName={'dash-block h-[3.25rem] rounded-2xl px-3 py-3.5 [&_.truncate]:whitespace-nowrap!'}
      renderIcon={(kind) => <KindIcon kind={kind} />}
    />
  )
}

interface IdentitySelectProps {
  identities: IdentityApiDto[]
  loading: boolean
  error: string | null
  selected: IdentityApiDto | undefined
  onSelect: (identifier: string) => void
  onRetry: () => void
}

function IdentityName({identity}: {identity: IdentityApiDto}): React.JSX.Element {
  if (identity.alias) {
    return <Text size={14} weight={"medium"} color={"brand"} className={"break-all text-left"}>{identity.alias}</Text>
  }
  return <Identifier highlight={"both"} ellipsis className={CONTACT_IDENTIFIER_CLASS}>{identity.identifier}</Identifier>
}

function IdentitySelect({identities, loading, error, selected, onSelect, onRetry}: IdentitySelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  let content: React.JSX.Element
  if (selected) {
    content = (
      <div className={"flex flex-col items-start min-w-0"}>
        <IdentityName identity={selected} />
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          <CreditsAmount credits={BigInt(String(selected.balance.amount))} />
        </Text>
      </div>
    )
  } else if (loading || error) {
    content = <Text size={14} weight={"medium"} color={"brand"} opacity={50}>Identities</Text>
  } else {
    content = <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No identities in this wallet</Text>
  }

  let action: React.JSX.Element | null = null
  if (loading) {
    action = <span role="status" aria-label="Loading identities"><Spinner size={14} className="dash-text-primary" /></span>
  } else if (error || identities.length === 0) {
    action = <RefreshIcon size={14} color="currentColor" className="dash-text-primary" />
  } else if (identities.length > 0) {
    action = (
      <ChevronIcon
        size={12}
        color="currentColor"
        className={`shrink-0 dash-text-default transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      />
    )
  }

  const handleClick = (): void => {
    if (error || identities.length === 0) {
      if (!loading) onRetry()
      return
    }
    setOpen(value => !value)
  }

  return (
    <div className={"relative"} ref={ref}>
      <button
        type={"button"}
        aria-label={error || identities.length === 0 ? 'Reload identities' : 'Select identity'}
        aria-busy={loading}
        disabled={loading}
        onClick={handleClick}
        className={"w-full min-h-13 dash-block rounded-2xl px-4 py-2 flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity"}
      >
        {content}
        {action}
      </button>

      {open && !loading && !error && (
        <div className={`absolute left-0 right-0 top-[calc(100%+.375rem)] z-30 max-h-60 overflow-y-auto scrollbar-custom ${POPOVER}`}>
          {identities.map(identity => (
            <button
              key={identity.identifier}
              type={"button"}
              onClick={() => { onSelect(identity.identifier); setOpen(false) }}
              className={`w-full flex flex-col gap-0.5 text-left ${POPOVER_OPTION} ${identity.identifier === selected?.identifier ? 'dash-block-accent-5' : ''}`}
            >
              <IdentityName identity={identity} />
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                <CreditsAmount credits={BigInt(String(identity.balance.amount))} />
              </Text>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface SourcePickerProps {
  kind: SourceKind
  onKindChange: (kind: SourceKind) => void
  kinds?: Array<{kind: SourceKind; label: string}>
  label?: string
  platformAddresses: PlatformAddressDto[]
  selectedPlatformAddress: PlatformAddressDto | undefined
  onPlatformAddressChange: (address: string) => void
  platformAutomaticLabel?: string
  platformAddressesLoading?: boolean
  platformAddressesError?: string | null
  onRetryPlatformAddresses?: () => void
  // Off while the inputs are being picked, which lists the same addresses.
  showPlatformAddress?: boolean
  identities: IdentityApiDto[]
  identitiesLoading: boolean
  identitiesError: string | null
  selectedIdentity: IdentityApiDto | undefined
  onIdentityChange: (identifier: string) => void
  onRetryIdentities: () => void
  compact?: boolean
  trailingControl?: React.ReactNode
}

export function SourcePicker({
  kind,
  onKindChange,
  kinds = SOURCE_KINDS,
  label = 'From',
  platformAddresses,
  selectedPlatformAddress,
  onPlatformAddressChange,
  platformAutomaticLabel,
  platformAddressesLoading = false,
  platformAddressesError = null,
  onRetryPlatformAddresses,
  showPlatformAddress = true,
  identities,
  identitiesLoading,
  identitiesError,
  selectedIdentity,
  onIdentityChange,
  onRetryIdentities,
  trailingControl,
}: SourcePickerProps): React.JSX.Element {
  const sourceControl = <>
    {kind === SourceKind.PlatformAddress && showPlatformAddress && (
      <PlatformAddressSelect
        addresses={platformAddresses}
        selected={selectedPlatformAddress}
        onSelect={onPlatformAddressChange}
        automaticLabel={platformAutomaticLabel}
        loading={platformAddressesLoading}
        error={platformAddressesError}
        onRetry={onRetryPlatformAddresses}
      />
    )}
    {kind === SourceKind.Identity && (
      <IdentitySelect
        identities={identities}
        loading={identitiesLoading}
        error={identitiesError}
        selected={selectedIdentity}
        onSelect={onIdentityChange}
        onRetry={onRetryIdentities}
      />
    )}
  </>

  return (
    <div className={'flex flex-col gap-2.5'}>
      <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{label}</Text>
      <div className="flex flex-col sm:flex-row! gap-3">
        <div className="sm:w-[11.75rem]! shrink-0">
          <KindDropdown kinds={kinds} selected={kind} onSelect={k => onKindChange(k as SourceKind)} />
        </div>
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          {sourceControl}
          {trailingControl}
        </div>
      </div>
    </div>
  )
}

export function DestinationPicker({
  kind,
  kinds,
  onKindChange,
  value,
  onValueChange,
  placeholder,
  error,
  showValueInput,
  ownOptions,
  ownOptionsLoading = false,
  ownOptionsError = null,
  onRetryOwnOptions,
  trailingControl,
}: DestinationPickerProps): React.JSX.Element {
  const recipientLabel = kind === DestinationKind.Identity ? 'Recipient identity ID' : 'Recipient address'
  let recipientOptionsStatus: React.JSX.Element | undefined
  if (ownOptionsLoading || (ownOptionsError && onRetryOwnOptions)) {
    recipientOptionsStatus = <span className="flex items-center gap-2">
      {ownOptionsLoading && <span role="status" aria-label="Loading recipient options"><Spinner size={12} className="dash-text-primary" /></span>}
      {!ownOptionsLoading && ownOptionsError && onRetryOwnOptions && <button type="button" onClick={onRetryOwnOptions} aria-label="Reload recipient options" title="Reload recipient options" className="dash-text-primary cursor-pointer hover:opacity-70">
        <RefreshIcon size={14} color="currentColor" />
      </button>}
    </span>
  }
  const fieldClassName = `${FIELD_COMPACT} ${error ? FIELD_INVALID : ''}`
  const valueControl = showValueInput && kind !== DestinationKind.NewIdentity && (
    ownOptions ? <DropdownField
      editable
      highlightValue
      ariaLabel={recipientLabel}
      value={value}
      onChange={onValueChange}
      options={ownOptions}
      menuHeading={kind === DestinationKind.Identity ? 'Your identities' : 'Your addresses'}
      placeholder={placeholder}
      inputInvalid={!!error}
      inputSuffix={recipientOptionsStatus}
      triggerClassName={fieldClassName}
    /> : <div className={`flex items-center ${fieldClassName}`}>
      <input
        type={"text"}
        aria-label={recipientLabel}
        aria-invalid={!!error}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value)}
        className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <div className={'flex flex-col gap-2.5'}>
      <Text size={14} weight={"medium"} color={"brand"} opacity={50}>To</Text>
      <div className="flex flex-col sm:flex-row! gap-3">
        <div className="sm:w-[11.75rem]! shrink-0">
          <KindDropdown kinds={kinds} selected={kind} onSelect={k => onKindChange(k as DestinationKind)} />
        </div>
        <div className="min-w-0 flex-1">
          {valueControl}
          {trailingControl}
        </div>
      </div>
      {showValueInput && kind !== DestinationKind.NewIdentity && error && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{error}</Text>}
      {showValueInput && kind === DestinationKind.NewIdentity && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"px-1 leading-[130%]"}>
          A new identity with a standard key set will be registered and funded from the selected address.
        </Text>
      )}
    </div>
  )
}
