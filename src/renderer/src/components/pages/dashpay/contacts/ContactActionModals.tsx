import { ContactAction } from '@renderer/enums/DashPay'
import type { ContactActionModalsProps } from '@renderer/types/DashPayContacts'
import AcceptRequestModal from './AcceptRequestModal'
import PayContactModal from './PayContactModal'

export default function ContactActionModals({ modal, contacts, identity, onModalChange }: ContactActionModalsProps): React.JSX.Element | null {
  if (modal == null) return null
  const close = (): void => onModalChange({ ...modal, open: false })

  if (modal.action === ContactAction.Accept) {
    return (
      <AcceptRequestModal
        open={modal.open}
        onClose={close}
        contact={modal.contact}
        identity={identity}
        onPay={(contact) => onModalChange({ action: ContactAction.Pay, contact, open: true })}
      />
    )
  }

  const contact = contacts.find(entry => entry.contactId === modal.contact.contactId) ?? modal.contact
  return <PayContactModal open={modal.open} onClose={close} contact={contact} identity={identity} />
}
