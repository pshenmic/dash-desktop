import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Heading, Input, Text } from '../dash-ui-kit-enxtended'
import CustomBadge from '../ui/CustomBadge'
import { useAuth } from '@renderer/contexts/AuthContext'
import { ADDRESS_BOOK_TYPES } from '@renderer/constants/addressBook'
import type { ContactEditModalProps } from '@renderer/types/AddressBook'
import { addressKey, getAddressKind, getContactKind } from '@renderer/utils/addressBook'
import { getErrorMessage } from '@renderer/utils/error'
import { toast } from '../ui/Toast'

export default function ContactEditModal({ contact, address = '', owned, onClose, onSave }: ContactEditModalProps): React.JSX.Element {
  const { status } = useAuth()
  const [label, setLabel] = useState(contact?.label ?? '')
  const [value, setValue] = useState(contact?.address ?? address)
  const [busy, setBusy] = useState(false)
  const kind = getContactKind(value, status?.network ?? undefined)

  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (busy) return
    if (!label.trim() || !kind) {
      toast.error(!label.trim() ? '**Name required** Enter a name.' : `**Invalid address** Enter a valid address or identity ID for ${status?.network}.`)
      return
    }
    setBusy(true)
    try {
      await onSave(label.trim(), addressKey(value), kind)
      onClose()
    } catch (error) {
      toast.error(`**Could not save address** ${getErrorMessage(error)}`)
      setBusy(false)
    }
  }

  return createPortal(<div className="fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in">
    <form role="dialog" aria-modal="true" aria-labelledby="contact-title" onSubmit={save} onKeyDown={event => { if (event.key === 'Escape' && !busy) onClose() }} className="w-full max-w-lg rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in flex flex-col gap-5">
      <Heading as="h2" size="xl" color="brand-white"><span id="contact-title">{contact ? 'Edit address' : 'Add address'}</span></Heading>
      <label className="flex flex-col gap-2 dash-text-default text-sm">Name
        <Input autoFocus value={label} onChange={event => setLabel(event.target.value)} disabled={busy} placeholder="e.g. Savings or Alex" size="sm" colorScheme="primary" variant="outlined" className="bg-transparent!" />
      </label>
      <label className="flex flex-col gap-2 dash-text-default text-sm">Address or identity ID
        <Input value={value} onChange={event => setValue(event.target.value)} disabled={busy} placeholder="Paste an address or identity ID" size="sm" colorScheme="primary" variant="outlined" className="bg-transparent! font-mono" />
      </label>
      <div className="flex items-center gap-2">
        <Text size={12} color="brand" opacity={50}>{ADDRESS_BOOK_TYPES.find(item => item.value === getAddressKind(value))?.label ?? 'Type detected from address'} · {status?.network}</Text>
        {owned.has(addressKey(value)) && <CustomBadge text="This wallet" />}
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" colorScheme="brand-mint" size="sm" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button type="submit" colorScheme="primary" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</Button>
      </div>
    </form>
  </div>, document.body)
}
