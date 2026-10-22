import SearchField from '@renderer/components/ui/SearchField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { ADDRESS_USAGE_OPTIONS, WALLET_ADDRESSES_COPY } from '@renderer/constants/addressBook'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import type { WalletAddressToolbarProps } from '@renderer/types/AddressBook'

export default function WalletAddressToolbar({ query, onQueryChange, usage, onUsageChange }: WalletAddressToolbarProps): React.JSX.Element {
  return (
    <div className={'flex flex-wrap items-center gap-3'}>
      <SearchField
        value={query}
        onChange={onQueryChange}
        placeholder={WALLET_ADDRESSES_COPY.searchPlaceholder}
        ariaLabel={WALLET_ADDRESSES_COPY.searchLabel}
        className={'flex-1 min-w-0 max-w-[22rem]'}
      />
      <SegmentedControl
        appearance={SegmentedControlAppearance.Pill}
        ariaLabel={WALLET_ADDRESSES_COPY.usageLabel}
        options={ADDRESS_USAGE_OPTIONS}
        value={usage}
        onChange={onUsageChange}
      />
    </div>
  )
}
