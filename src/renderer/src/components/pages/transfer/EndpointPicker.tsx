import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import { PlatformAddressDto } from "@renderer/api/types";
import { IdentityApiDto } from "@renderer/hooks/useIdentities";
import { SOURCE_KINDS } from "@renderer/utils/transferMatrix";
import { SourceKind } from "@renderer/enums/SourceKind";
import { DestinationKind } from "@renderer/enums/DestinationKind";
import { ADDRESS_INPUT, ADDRESS_INPUT_TEXT_SIZES, FIELD_INVALID } from "@renderer/constants/addressField";
import { FIELD_COMPACT } from "@renderer/constants/surfaces";
import PlatformAddressSelect from "./PlatformAddressSelect";
import EndpointKindIcon from "./EndpointKindIcon";
import DropdownField from "@renderer/components/ui/DropdownField";
import IdentitySelect from "@renderer/components/ui/IdentitySelect";
import type { DestinationPickerProps, EndpointKindEntry } from "@renderer/types/EndpointPicker";
import Spinner from "@renderer/components/ui/Spinner";
import { RefreshIcon } from "@renderer/components/dash-ui-kit-enxtended/icons";

interface KindDropdownProps {
  kinds: EndpointKindEntry[]
  selected: string
  onSelect: (kind: string) => void
}

function KindDropdown({kinds, selected, onSelect}: KindDropdownProps): React.JSX.Element {
  return (
    <DropdownField
      options={kinds.map(({kind, label}) => ({value: kind, label}))}
      value={selected}
      onChange={onSelect}
      ariaLabel="Select transfer type"
      triggerClassName={'dash-block h-[3.25rem] rounded-2xl px-3 py-3.5 [&_.truncate]:whitespace-nowrap!'}
      renderIcon={(kind) => <EndpointKindIcon kind={kind} />}
    />
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
      valueAvatar={kind === DestinationKind.Identity}
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
