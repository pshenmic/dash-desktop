import { ArrowIcon, HighlightedIdentifier, Text, Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import { ContextMenu } from '@renderer/components/ui/ContextMenu'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import { CONTACT_IDENTIFIER_CLASS } from '@renderer/constants/addressField'
import { DASHPAY_CONTACT_ROW_CLASS } from '@renderer/constants/dashPay'
import {
  CONTACT_MENU_COPY,
  CONTACT_ROW_ACTION_CLASS,
  CONTACT_ROW_CONTENT_CLASS,
  CONTACT_ROW_COPY,
  CONTACT_ROW_TRAILING_CLASS,
  CONTACTS_TAB_COPY,
} from '@renderer/constants/dashPayContacts'
import { ROW_OPEN_OVERLAY_CLASS } from '@renderer/constants/listToolbar'
import { DashPayContactRelationship } from '@renderer/enums/DashPay'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import type { ContextMenuItem } from '@renderer/types/ContextMenu'
import type { ContactRowProps } from '@renderer/types/DashPayContacts'
import { copyWithToast } from '@renderer/utils/clipboard'
import { contactDisplayName } from '@renderer/utils/dashPayContactList'
import { contactRowCaption, extraNamesLabel } from '@renderer/utils/dashPayContactView'

export default function ContactRow({ model, now, canSend, onOpen, onAccept, onPay }: ContactRowProps): React.JSX.Element {
  const { contact, name, extraNames, isWalletIdentity, payable } = model
  const displayName = contactDisplayName(contact)
  const incoming = contact.relationship === DashPayContactRelationship.Incoming
  const canAccept = incoming && !contact.paymentChannelBroken

  const items: ContextMenuItem[] = [{ id: 'open', label: CONTACT_MENU_COPY.open, onSelect: () => onOpen(contact.contactId) }]
  if (payable) items.push({ id: 'pay', label: CONTACT_MENU_COPY.pay, onSelect: () => onPay(contact) })
  if (canAccept && canSend) items.push({ id: 'accept', label: CONTACT_MENU_COPY.accept, onSelect: () => onAccept(contact) })
  items.push({ id: 'copy-id', label: CONTACT_MENU_COPY.copyId, onSelect: () => copyWithToast(contact.contactId) })
  if (name != null) items.push({ id: 'copy-name', label: CONTACT_MENU_COPY.copyName, onSelect: () => copyWithToast(name) })

  let action: React.JSX.Element
  if (contact.paymentChannelBroken && contact.relationship !== DashPayContactRelationship.Outgoing) {
    action = (
      <Tooltip label={CONTACT_ROW_COPY.cantPayHint}>
        <span className={'pointer-events-auto inline-flex'}>
          <CustomBadge variant={'error'} text={CONTACT_ROW_COPY.cantPay} className={'whitespace-nowrap'} />
        </span>
      </Tooltip>
    )
  } else if (incoming) {
    const button = (
      <button type={'button'} disabled={!canSend} onClick={() => onAccept(contact)} className={CONTACT_ROW_ACTION_CLASS}>
        {CONTACT_ROW_COPY.accept}
      </button>
    )
    action = canSend ? button : (
      <Tooltip label={CONTACTS_TAB_COPY.enableFirst}>
        <span className={'pointer-events-auto inline-flex'}>{button}</span>
      </Tooltip>
    )
  } else if (payable) {
    action = (
      <button type={'button'} onClick={() => onPay(contact)} className={CONTACT_ROW_ACTION_CLASS}>
        {CONTACT_ROW_COPY.pay}
      </button>
    )
  } else {
    action = <CustomBadge variant={'muted'} text={CONTACT_ROW_COPY.awaiting} className={'whitespace-nowrap'} />
  }

  return (
    <ContextMenu title={CONTACT_MENU_COPY.title} items={items}>
      <li className={DASHPAY_CONTACT_ROW_CLASS}>
        <button
          type={'button'}
          onClick={() => onOpen(contact.contactId)}
          aria-label={`${CONTACT_ROW_COPY.open} ${displayName}`}
          className={ROW_OPEN_OVERLAY_CLASS}
        />
        <span className={'pointer-events-none flex'}>
          <IdentityAvatar identifier={contact.contactId} size={IdentityAvatarSize.Sm} />
        </span>
        <div className={CONTACT_ROW_CONTENT_CLASS}>
          <div className={'flex min-w-0 items-center gap-1.5'}>
            {name != null ? (
              <Text reset size={14} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{name}</Text>
            ) : (
              <HighlightedIdentifier className={CONTACT_IDENTIFIER_CLASS}>{contact.contactId}</HighlightedIdentifier>
            )}
            {extraNames > 0 && <CustomBadge variant={'muted'} text={extraNamesLabel(extraNames)} className={'shrink-0'} />}
            {isWalletIdentity && <CustomBadge variant={'accent'} text={CONTACT_ROW_COPY.yourIdentity} className={'shrink-0 whitespace-nowrap'} />}
          </div>
          <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'min-w-0 wrap-anywhere'}>
            {contactRowCaption(model, now)}
          </Text>
        </div>
        <div className={CONTACT_ROW_TRAILING_CLASS}>
          {action}
          <ArrowIcon size={9} color={'currentColor'} className={'rotate-180 opacity-40 dash-text-default'} />
        </div>
      </li>
    </ContextMenu>
  )
}
