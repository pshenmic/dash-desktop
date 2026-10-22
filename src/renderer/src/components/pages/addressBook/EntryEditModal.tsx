import { useId, useState } from 'react'
import { Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import { toast } from '@renderer/components/ui/Toast'
import { ADDRESS_BOOK_COPY, ADDRESS_BOOK_KIND_LABELS, ENTRY_EDIT_COPY, ENTRY_INPUT_CLASS } from '@renderer/constants/addressBook'
import { AddressBookAddressCheck } from '@renderer/enums/AddressBook'
import { ModalSize } from '@renderer/enums/ModalSize'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import type { AddressBookEditorState, EntryEditModalProps } from '@renderer/types/AddressBook'
import { addressBookAddressStatus, addressBookKey } from '@renderer/utils/addressBook'
import { duplicateEntryMessage, invalidEntryAddressMessage } from '@renderer/utils/addressBookView'
import { getErrorMessage } from '@renderer/utils/error'

export default function EntryEditModal({ state, owned, onClose }: EntryEditModalProps): React.JSX.Element {
  const nameId = useId()
  const addressId = useId()
  const { contacts, network, addContact, updateContact } = useAddressBook()
  const [opened, setOpened] = useState<AddressBookEditorState | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  if (state !== null && state !== opened) {
    setOpened(state)
    setName(state.contact?.label ?? '')
    setAddress(state.contact?.address ?? state.address)
  }

  const contact = opened?.contact ?? null
  const status = addressBookAddressStatus(address, network ?? null, contacts, contact?.id ?? null)
  const trimmedName = name.trim()
  const unchanged = contact != null && trimmedName === contact.label && addressBookKey(address) === addressBookKey(contact.address)
  const canSave = trimmedName !== '' && status.check === AddressBookAddressCheck.Valid && !unchanged && !saving
  const addressInvalid = status.check === AddressBookAddressCheck.Invalid || status.check === AddressBookAddressCheck.Duplicate

  const save = async (): Promise<void> => {
    if (!canSave) return
    setSaving(true)
    try {
      if (contact == null) await addContact(trimmedName, address)
      else await updateContact(contact, trimmedName, address)
      toast.success(`**${contact == null ? ENTRY_EDIT_COPY.added : ENTRY_EDIT_COPY.updated}** ${trimmedName}`)
      onClose()
    } catch (e) {
      toast.error(`**${ENTRY_EDIT_COPY.failed}** ${getErrorMessage(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const submitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') void save()
  }

  let addressNote: React.JSX.Element | null = null
  if (status.check === AddressBookAddressCheck.Invalid) {
    addressNote = <Text size={12} weight={'medium'} color={'red'}>{invalidEntryAddressMessage(network)}</Text>
  } else if (status.check === AddressBookAddressCheck.Duplicate && status.duplicate != null) {
    addressNote = <Text size={12} weight={'medium'} color={'red'}>{duplicateEntryMessage(status.duplicate.label)}</Text>
  } else if (status.kind != null) {
    addressNote = (
      <span className={'flex items-center gap-1.5'}>
        <CustomBadge variant={'muted'} text={ADDRESS_BOOK_KIND_LABELS[status.kind]} />
        {owned?.has(addressBookKey(address)) && <CustomBadge variant={'accent'} text={ADDRESS_BOOK_COPY.thisWallet} />}
      </span>
    )
  }

  return (
    <Modal
      open={state !== null}
      onClose={onClose}
      title={contact == null ? ENTRY_EDIT_COPY.addTitle : ENTRY_EDIT_COPY.editTitle}
      size={ModalSize.Md}
      dismissible={!saving}
    >
      <div className={'mt-5 flex flex-col'}>
        <label htmlFor={nameId} className={'mb-2'}>
          <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{ENTRY_EDIT_COPY.nameLabel}</Text>
        </label>
        <Input
          id={nameId}
          type={'text'}
          variant={'outlined'}
          colorScheme={'primary'}
          placeholder={ENTRY_EDIT_COPY.namePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={submitOnEnter}
          disabled={saving}
          autoComplete={'off'}
          autoFocus
          className={ENTRY_INPUT_CLASS}
        />
      </div>
      <div className={'mt-4 flex flex-col'}>
        <label htmlFor={addressId} className={'mb-2'}>
          <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{ENTRY_EDIT_COPY.addressLabel}</Text>
        </label>
        <Input
          id={addressId}
          type={'text'}
          variant={'outlined'}
          colorScheme={addressInvalid ? 'error' : 'primary'}
          placeholder={ENTRY_EDIT_COPY.addressPlaceholder}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          onKeyDown={submitOnEnter}
          disabled={saving}
          spellCheck={false}
          autoComplete={'off'}
          aria-invalid={addressInvalid}
          className={ENTRY_INPUT_CLASS}
        />
        {addressNote != null && <div className={'mt-2 px-1'}>{addressNote}</div>}
      </div>
      <ModalActions
        secondary={{ label: ENTRY_EDIT_COPY.cancel, onClick: onClose, disabled: saving }}
        primary={{ label: ENTRY_EDIT_COPY.save, onClick: () => { void save() }, disabled: !canSave, loading: saving }}
      />
    </Modal>
  )
}
