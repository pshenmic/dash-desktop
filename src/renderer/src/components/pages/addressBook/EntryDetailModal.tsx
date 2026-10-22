import { useState } from 'react'
import { ExternalLinkIcon, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { DeleteIcon, PencilIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import AddressQrModal from '@renderer/components/modal/AddressQrModal'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import QrButton from '@renderer/components/ui/QrButton'
import { ADDRESS_BOOK_COPY, ADDRESS_BOOK_KIND_LABELS, ENTRY_DETAIL_COPY } from '@renderer/constants/addressBook'
import { ADDRESS_ROW_ICON_BUTTON_CLASS, ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { ModalSize } from '@renderer/enums/ModalSize'
import type { AddressBookEntry, EntryDetailLine, EntryDetailModalProps } from '@renderer/types/AddressBook'
import { entryExplorerUrl } from '@renderer/utils/addressBookView'
import { formatTimestamp } from '@renderer/utils/date'
import { openExternal } from '@renderer/utils/explorer'
import AddressBookKindIcon from './AddressBookKindIcon'

function DetailLine({ label, value }: EntryDetailLine): React.JSX.Element {
  return (
    <div className={'flex items-start justify-between gap-4'}>
      <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0'}>{label}</Text>
      <Text size={12} weight={'medium'} color={'brand'} className={'min-w-0 break-all text-right'}>{value}</Text>
    </div>
  )
}

export default function EntryDetailModal({ entry, network, onClose, onSend, onEdit, onRemove }: EntryDetailModalProps): React.JSX.Element | null {
  const [shown, setShown] = useState<AddressBookEntry | null>(entry)
  const [qrOpen, setQrOpen] = useState(false)
  if (entry !== null && entry !== shown) setShown(entry)
  if (shown == null) return null

  const { contact, kind, owned } = shown
  const explorerUrl = kind != null && network != null ? entryExplorerUrl(kind, contact.address, network) : null
  const lines: EntryDetailLine[] = [
    { label: ENTRY_DETAIL_COPY.type, value: kind == null ? ADDRESS_BOOK_COPY.unrecognized : ADDRESS_BOOK_KIND_LABELS[kind] },
    { label: ENTRY_DETAIL_COPY.network, value: contact.network },
    { label: ENTRY_DETAIL_COPY.added, value: formatTimestamp(new Date(contact.createdAt)) },
  ]

  return (
    <>
      <Modal
        open={entry !== null && !qrOpen}
        onClose={onClose}
        title={contact.label}
        description={kind == null ? ADDRESS_BOOK_COPY.unrecognizedHint : undefined}
        size={ModalSize.Md}
      >
        <div className={`mt-5 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
          <div className={'flex items-start gap-3'}>
            <AddressBookKindIcon kind={kind} address={contact.address} />
            <div className={'flex min-w-0 flex-1 flex-col gap-2'}>
              <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>{contact.address}</HighlightedIdentifier>
              <div className={'flex items-center gap-[.3125rem]'}>
                <CopyButton text={contact.address} className={'shrink-0'} />
                <QrButton onClick={() => setQrOpen(true)} ariaLabel={ENTRY_DETAIL_COPY.showQr} className={'shrink-0'} />
                {explorerUrl != null && (
                  <button
                    type={'button'}
                    onClick={() => openExternal(explorerUrl)}
                    title={ENTRY_DETAIL_COPY.explorer}
                    aria-label={ENTRY_DETAIL_COPY.explorer}
                    className={ADDRESS_ROW_ICON_BUTTON_CLASS}
                  >
                    <ExternalLinkIcon size={10} color={'currentColor'} className={'dash-text-default opacity-50'} />
                  </button>
                )}
                {owned && <CustomBadge variant={'accent'} text={ADDRESS_BOOK_COPY.thisWallet} className={'ml-1'} />}
                <span className={'ml-auto flex items-center gap-[.3125rem]'}>
                  <button
                    type={'button'}
                    onClick={() => onEdit(contact)}
                    title={ENTRY_DETAIL_COPY.edit}
                    aria-label={ENTRY_DETAIL_COPY.edit}
                    className={ADDRESS_ROW_ICON_BUTTON_CLASS}
                  >
                    <PencilIcon size={10} color={'currentColor'} className={'dash-text-default opacity-50'} />
                  </button>
                  <button
                    type={'button'}
                    onClick={() => onRemove(contact)}
                    title={ENTRY_DETAIL_COPY.remove}
                    aria-label={ENTRY_DETAIL_COPY.remove}
                    className={ADDRESS_ROW_ICON_BUTTON_CLASS}
                  >
                    <DeleteIcon size={10} color={'currentColor'} className={'text-dash-red opacity-70'} />
                  </button>
                </span>
              </div>
            </div>
          </div>
          {lines.map(line => <DetailLine key={line.label} label={line.label} value={line.value} />)}
        </div>
        <ModalActions
          secondary={{ label: ENTRY_DETAIL_COPY.close, onClick: onClose }}
          primary={{ label: ENTRY_DETAIL_COPY.send, onClick: () => onSend(shown), disabled: kind == null }}
        />
      </Modal>
      {qrOpen && (
        <AddressQrModal
          address={contact.address}
          title={contact.label}
          uri={kind === DestinationKind.CoreAddress}
          onClose={() => setQrOpen(false)}
        />
      )}
    </>
  )
}
