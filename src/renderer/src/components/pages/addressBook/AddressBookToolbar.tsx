import { FilterIcon } from '@renderer/components/dash-ui-kit-enxtended'
import DropdownField from '@renderer/components/ui/DropdownField'
import SearchField from '@renderer/components/ui/SearchField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { ADDRESS_BOOK_COPY, ADDRESS_BOOK_SORT_OPTIONS } from '@renderer/constants/addressBook'
import { TOOLBAR_DROPDOWN_CLASS } from '@renderer/constants/listToolbar'
import { AddressBookSort } from '@renderer/enums/AddressBook'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import type { AddressBookToolbarProps } from '@renderer/types/AddressBook'
import { addressBookSegmentOptions } from '@renderer/utils/addressBookView'
import { enumParam } from '@renderer/utils/searchParams'

export default function AddressBookToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  segment,
  onSegmentChange,
  counts,
}: AddressBookToolbarProps): React.JSX.Element {
  return (
    <div className={'flex flex-col gap-3'}>
      <div className={'flex items-center gap-3'}>
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder={ADDRESS_BOOK_COPY.searchPlaceholder}
          ariaLabel={ADDRESS_BOOK_COPY.searchLabel}
          className={'flex-1 min-w-0 max-w-[22rem]'}
        />
        <DropdownField
          options={ADDRESS_BOOK_SORT_OPTIONS}
          value={sort}
          onChange={(value) => onSortChange(enumParam(AddressBookSort, value, AddressBookSort.Name))}
          textSize={12}
          triggerClassName={TOOLBAR_DROPDOWN_CLASS}
          ariaLabel={ADDRESS_BOOK_COPY.sortLabel}
          renderIcon={() => <FilterIcon size={12} color={'currentColor'} className={'dash-text-primary'} />}
        />
      </div>
      <SegmentedControl
        appearance={SegmentedControlAppearance.Pill}
        ariaLabel={ADDRESS_BOOK_COPY.segmentLabel}
        options={addressBookSegmentOptions(counts)}
        value={segment}
        onChange={onSegmentChange}
        className={'self-start'}
      />
    </div>
  )
}
