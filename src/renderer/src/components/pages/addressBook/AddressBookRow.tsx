import { ArrowIcon, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { CopyIcon2, DeleteIcon, PencilIcon, SendIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import {
  ADDRESS_BOOK_COPY,
  ADDRESS_BOOK_ROW_ACTION_CLASS,
  ADDRESS_BOOK_ROW_CLASS,
  ADDRESS_BOOK_ROW_CONTENT_CLASS,
  ADDRESS_BOOK_ROW_TRAILING_CLASS,
} from '@renderer/constants/addressBook'
import { ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { ROW_OPEN_OVERLAY_CLASS } from '@renderer/constants/listToolbar'
import type { ContextMenuItem } from '@renderer/types/ContextMenu'
import type { AddressBookRowProps } from '@renderer/types/AddressBook'
import { copyWithToast } from '@renderer/utils/clipboard'
import AddressBookKindIcon from './AddressBookKindIcon'

export default function AddressBookRow({ entry, onOpen, onSend, onEdit, onRemove }: AddressBookRowProps): React.JSX.Element {
  const { contact, kind, owned } = entry
  const items: ContextMenuItem[] = []
  if (kind != null) {
    items.push({ id: 'send', label: ADDRESS_BOOK_COPY.send, icon: <SendIcon size={10} color={'currentColor'} />, onSelect: () => onSend(entry) })
  }
  items.push(
    { id: 'copy', label: ADDRESS_BOOK_COPY.copyAddress, icon: <CopyIcon2 size={10} color={'currentColor'} />, onSelect: () => copyWithToast(contact.address) },
    { id: 'edit', label: ADDRESS_BOOK_COPY.edit, icon: <PencilIcon size={10} color={'currentColor'} />, onSelect: () => onEdit(contact) },
    { id: 'remove', label: ADDRESS_BOOK_COPY.remove, icon: <DeleteIcon size={10} color={'currentColor'} />, tone: 'danger', onSelect: () => onRemove(contact) },
  )

  return (
    <ContextMenu title={ADDRESS_BOOK_COPY.menuTitle} items={items}>
      <li className={ADDRESS_BOOK_ROW_CLASS}>
        <button
          type={'button'}
          onClick={() => onOpen(entry)}
          aria-label={`${ADDRESS_BOOK_COPY.open} ${contact.label}`}
          className={ROW_OPEN_OVERLAY_CLASS}
        />
        <span className={'pointer-events-none flex'}>
          <AddressBookKindIcon kind={kind} address={contact.address} />
        </span>
        <div className={ADDRESS_BOOK_ROW_CONTENT_CLASS}>
          <div className={'flex min-w-0 items-center gap-1.5'}>
            <Text reset size={14} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{contact.label}</Text>
            {owned && <CustomBadge variant={'accent'} text={ADDRESS_BOOK_COPY.thisWallet} className={'shrink-0 whitespace-nowrap'} />}
            {kind == null && <CustomBadge variant={'error'} text={ADDRESS_BOOK_COPY.unrecognized} className={'shrink-0 whitespace-nowrap'} />}
          </div>
          <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>{contact.address}</HighlightedIdentifier>
        </div>
        <div className={ADDRESS_BOOK_ROW_TRAILING_CLASS}>
          <button type={'button'} disabled={kind == null} onClick={() => onSend(entry)} className={ADDRESS_BOOK_ROW_ACTION_CLASS}>
            {ADDRESS_BOOK_COPY.send}
          </button>
          <ArrowIcon size={9} color={'currentColor'} className={'rotate-180 opacity-40 dash-text-default'} />
        </div>
      </li>
    </ContextMenu>
  )
}
