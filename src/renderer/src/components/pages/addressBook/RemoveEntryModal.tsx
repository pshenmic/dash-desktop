import { useState } from 'react'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import { toast } from '@renderer/components/ui/Toast'
import { REMOVE_ENTRY_COPY } from '@renderer/constants/addressBook'
import { ModalActionTone } from '@renderer/enums/ModalActionTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import type { Contact } from '@renderer/api/types'
import type { RemoveEntryModalProps } from '@renderer/types/AddressBook'
import { removeEntryTitle } from '@renderer/utils/addressBookView'
import { getErrorMessage } from '@renderer/utils/error'

export default function RemoveEntryModal({ contact, onClose }: RemoveEntryModalProps): React.JSX.Element {
  const { deleteContact } = useAddressBook()
  const [shown, setShown] = useState<Contact | null>(contact)
  const [removing, setRemoving] = useState(false)
  if (contact !== null && contact !== shown) setShown(contact)

  const remove = async (): Promise<void> => {
    if (shown === null || removing) return
    setRemoving(true)
    try {
      await deleteContact(shown.id)
      toast.success(`**${REMOVE_ENTRY_COPY.removed}** ${shown.label}`)
      onClose()
    } catch (e) {
      toast.error(`**${REMOVE_ENTRY_COPY.failed}** ${getErrorMessage(e)}`)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Modal
      open={contact !== null}
      onClose={onClose}
      title={removeEntryTitle(shown?.label ?? '')}
      description={REMOVE_ENTRY_COPY.description}
      size={ModalSize.Sm}
      dismissible={!removing}
    >
      <ModalActions
        tone={ModalActionTone.Danger}
        secondary={{ label: REMOVE_ENTRY_COPY.cancel, onClick: onClose, disabled: removing }}
        primary={{ label: REMOVE_ENTRY_COPY.remove, onClick: () => { void remove() }, loading: removing }}
      />
    </Modal>
  )
}
