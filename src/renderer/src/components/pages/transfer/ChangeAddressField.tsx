import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import DropdownField from '@renderer/components/ui/DropdownField'
import type { ChangeAddressFieldProps } from '@renderer/types/ChangeAddress'
import { useAuth } from '@renderer/contexts/AuthContext'
import { isValidDashChangeAddress } from '@renderer/utils/address'
import { davToDash } from '@renderer/utils/balance'
import { selectedChangeAddress } from '@renderer/utils/changeAddress'

export default function ChangeAddressField({change, value, loading, error, previewOnly, onChange, onRetry}: ChangeAddressFieldProps): React.JSX.Element {
  const { status } = useAuth()
  const selected = selectedChangeAddress(change, value)
  const invalid = !!selected?.trim() && !isValidDashChangeAddress(selected, status?.network ?? undefined)
  const options = change.map(address => ({
    value: address.address,
    label: address.address,
    description: `${davToDash(address.balance)} Dash`,
  }))
  const selectedDescription = options.find(option => option.value === selected?.trim())?.description

  return (
    <section className="dash-block rounded-2xl p-4 flex flex-col gap-2">
      <Text size={14} weight="bold" color="brand">Change address</Text>
      <DropdownField
        ariaLabel="Change address"
        value={selected ?? ''}
        onChange={onChange}
        options={options}
        triggerClassName="dash-block rounded-[.875rem] px-4 py-3.5"
        editable
        placeholder="Enter an address or choose from your wallet"
        inputInvalid={invalid}
        inputSuffix={selectedDescription ? <Text size={12} weight="medium" color="brand" opacity={50}>{selectedDescription}</Text> : undefined}
      />
      {invalid && <Text size={12} weight="medium" color="red">Enter a valid P2PKH Dash address for this network.</Text>}
      {!previewOnly && !selected?.trim() && <Text size={12} weight="medium" color="brand" opacity={50}>Change address will be selected automatically.</Text>}
      {loading && <Text size={12} weight="medium" color="brand" opacity={50}>Loading wallet addresses…</Text>}
      {error && <button type="button" onClick={onRetry} className="self-start dash-text-primary text-xs cursor-pointer">Could not load wallet addresses. Try again</button>}
      {!loading && !error && options.length === 0 && <Text size={12} weight="medium" color="brand" opacity={50}>No change addresses available. Enter an address manually.</Text>}
      {previewOnly && <Text size={12} weight="medium" color="brand" opacity={50}>
        Preview only. Sending currently uses the automatic change address.
      </Text>}
    </section>
  )
}
