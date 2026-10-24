import { AddIcon, Button, FilterIcon, Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import DropdownField from '@renderer/components/ui/DropdownField'
import SearchField from '@renderer/components/ui/SearchField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { CONTACT_SORT_OPTIONS } from '@renderer/constants/dashPay'
import { CONTACTS_TAB_COPY } from '@renderer/constants/dashPayContacts'
import { TOOLBAR_DROPDOWN_CLASS } from '@renderer/constants/listToolbar'
import { ContactSort } from '@renderer/enums/DashPay'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import type { AddContactButtonProps, ContactsToolbarProps } from '@renderer/types/DashPayContacts'
import { contactSegmentOptions } from '@renderer/utils/dashPayContactView'
import { enumParam } from '@renderer/utils/searchParams'

export function AddContactButton({ canAdd, onAdd }: AddContactButtonProps): React.JSX.Element {
  const button = (
    <Button type={'button'} size={'compact'} colorScheme={'lightBlue-mint'} className={'gap-2'} disabled={!canAdd} onClick={onAdd}>
      <AddIcon size={12} color={'currentColor'} />
      {CONTACTS_TAB_COPY.add}
    </Button>
  )
  if (canAdd) return button
  return (
    <Tooltip label={CONTACTS_TAB_COPY.enableFirst}>
      <span className={'inline-flex'}>{button}</span>
    </Tooltip>
  )
}

export default function ContactsToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  segment,
  onSegmentChange,
  counts,
  canAdd,
  onAdd,
}: ContactsToolbarProps): React.JSX.Element {
  return (
    <div className={'flex flex-col gap-3'}>
      <div className={'flex items-center gap-3'}>
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder={CONTACTS_TAB_COPY.searchPlaceholder}
          ariaLabel={CONTACTS_TAB_COPY.searchLabel}
          className={'flex-1 min-w-0 max-w-[22rem]'}
        />
        <DropdownField
          options={CONTACT_SORT_OPTIONS}
          value={sort}
          onChange={(value) => onSortChange(enumParam(ContactSort, value, ContactSort.Recent))}
          textSize={12}
          triggerClassName={TOOLBAR_DROPDOWN_CLASS}
          ariaLabel={CONTACTS_TAB_COPY.sortLabel}
          renderIcon={() => <FilterIcon size={12} color={'currentColor'} className={'dash-text-primary'} />}
        />
        <div className={'ml-auto'}>
          <AddContactButton canAdd={canAdd} onAdd={onAdd} />
        </div>
      </div>
      <SegmentedControl
        appearance={SegmentedControlAppearance.Pill}
        ariaLabel={CONTACTS_TAB_COPY.segmentLabel}
        options={contactSegmentOptions(counts)}
        value={segment}
        onChange={onSegmentChange}
        className={'self-start'}
      />
    </div>
  )
}
