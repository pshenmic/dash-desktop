import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { RefreshIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import DropdownField from '@renderer/components/ui/DropdownField'
import Spinner from '@renderer/components/ui/Spinner'
import { FIELD_INVALID } from '@renderer/constants/addressField'
import { DESTINATION_PLACEHOLDERS } from '@renderer/constants/sendPages'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import type { ChangeAddressFieldProps } from '@renderer/types/ChangeAddress'
import { useAuth } from '@renderer/contexts/AuthContext'
import { isValidDashChangeAddress } from '@renderer/utils/address'
import { davToDash } from '@renderer/utils/balance'
import { selectedChangeAddress } from '@renderer/utils/changeAddress'
import { receiveCoreAddresses } from '@renderer/utils/receiveDefaults'

export default function ChangeAddressField({compact = false, change, value, loading, error, previewOnly, onChange, onRetry}: ChangeAddressFieldProps): React.JSX.Element {
  const { status } = useAuth()
  const selected = selectedChangeAddress(change, value)
  const invalid = !!selected?.trim() && !isValidDashChangeAddress(selected, status?.network ?? undefined)
  const options = receiveCoreAddresses(change).map(address => ({
    value: address.address,
    label: address.address,
    description: `${davToDash(address.balance)} Dash`,
  }))
  const selectedDescription = options.find(option => option.value === selected?.trim())?.description

  return (
    <section className="flex min-w-0 flex-col gap-2">
      {!compact && <Text size={12} weight="medium" color="brand" opacity={50}>Change address</Text>}
      <DropdownField
        ariaLabel="Change address"
        value={selected ?? ''}
        onChange={onChange}
        options={options}
        triggerClassName={`dash-block rounded-[.875rem] ${compact ? 'px-3.5 py-2' : 'px-4 py-3.5'} ${invalid ? FIELD_INVALID : ''}`}
        textSize={compact ? 12 : 14}
        editable
        highlightValue
        placeholder={DESTINATION_PLACEHOLDERS[DestinationKind.CoreAddress][status?.network ?? 'testnet']}
        inputInvalid={invalid}
        inputSuffix={selectedDescription || loading || error ? <span className="flex items-center gap-2">
          {selectedDescription && <Text size={12} weight="medium" color="brand" opacity={50}>{selectedDescription}</Text>}
          {loading && <span role="status" aria-label="Loading wallet addresses"><Spinner size={12} className="dash-text-primary" /></span>}
          {!loading && error && <button type="button" onClick={onRetry} aria-label="Reload wallet addresses" title="Reload wallet addresses" className="dash-text-primary cursor-pointer hover:opacity-70">
            <RefreshIcon size={14} color="currentColor" />
          </button>}
        </span> : undefined}
      />
      {invalid && <Text size={12} weight="medium" color="red" className="px-1">Enter a valid P2PKH Dash address for this network.</Text>}
      {!previewOnly && !selected?.trim() && <Text size={12} weight="medium" color="brand" opacity={50}>Change address will be selected automatically.</Text>}
      {!loading && !error && options.length === 0 && <Text size={12} weight="medium" color="brand" opacity={50}>No unused change addresses available. Enter an address manually.</Text>}
      {previewOnly && <Text size={12} weight="medium" color="brand" opacity={50}>
        Preview only. Sending currently uses the automatic change address.
      </Text>}
    </section>
  )
}
