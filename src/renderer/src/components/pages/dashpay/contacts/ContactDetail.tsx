import { useMemo, useState } from 'react'
import { TimeDelta } from 'dash-ui-kit/react'
import { Button, ExternalLinkIcon, HighlightedIdentifier, ReceiveIcon, SendIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { ExclamationIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import TransactionDetailToken from '@renderer/components/pages/transactions/TransactionDetailToken'
import ActingIdentityChip from '@renderer/components/ui/ActingIdentityChip'
import Alert from '@renderer/components/ui/Alert'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { DASH_UNIT } from '@renderer/constants/balance'
import { RELATIONSHIP_BADGES } from '@renderer/constants/dashPay'
import {
  CONTACT_DETAIL_COPY,
  CONTACT_DETAIL_ROOT_CLASS,
  CONTACT_MENU_COPY,
  CONTACT_OTHER_NAMES_LIMIT,
  CONTACT_PAYMENT_SKELETON_CLASS,
  CONTACT_PAYMENTS_SKELETON_ROWS,
  CONTACT_TOKEN_ICON_CLASS,
  EXPLORER_ICON_BUTTON_CLASS,
} from '@renderer/constants/dashPayContacts'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { TRANSACTION_DETAIL_CARD_CLASS, TRANSACTION_DETAIL_IDENTIFIER_CLASS } from '@renderer/constants/transactionsPage'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { ContactAction, DashPayContactRelationship } from '@renderer/enums/DashPay'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { useDashPayContacts } from '@renderer/hooks/useDashPayContacts'
import { useDashPayPayments } from '@renderer/hooks/useDashPayPayments'
import type { ContactDetailProps } from '@renderer/types/DashPayScreens'
import type { ContactModalState } from '@renderer/types/DashPayContacts'
import { davToDash } from '@renderer/utils/balance'
import { contactDisplayName, contactsForIdentity, isPayable } from '@renderer/utils/dashPayContactList'
import { brokenChannelDescription, contactDetailSubtitle, contactOtherNames } from '@renderer/utils/dashPayContactView'
import { paymentTotals } from '@renderer/utils/dashPayPayments'
import { dashPayReadiness } from '@renderer/utils/dashPayReadiness'
import { formatCreationDate } from '@renderer/utils/date'
import { identityUrl, openExternal } from '@renderer/utils/explorer'
import { identityLabel } from '@renderer/utils/identifierFormat'
import ContactActionModals from './ContactActionModals'
import ContactPayments from './ContactPayments'

function requestDate(timestamp: number | null): React.JSX.Element {
  if (timestamp == null) {
    return <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{CONTACT_DETAIL_COPY.missingValue}</Text>
  }
  return <Text size={14} weight={'extrabold'} color={'brand'}>{formatCreationDate(new Date(timestamp))}</Text>
}

export default function ContactDetail({
  walletId,
  identity,
  identities,
  contactId,
  paymentsVisibleCount,
  now,
  onShowMorePayments,
  onBack,
  onActAs,
}: ContactDetailProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const { isBalanceVisible } = useBalanceVisibility()
  const { contacts, loading } = useDashPayContacts(walletId)
  const [modal, setModal] = useState<ContactModalState | null>(null)
  const mine = useMemo(() => contactsForIdentity(contacts, identity.identifier), [contacts, identity.identifier])
  const contact = mine.find(entry => entry.contactId === contactId)
  const { payments, loading: paymentsLoading } = useDashPayPayments(walletId, identity.identifier, contact?.contactId)
  const totals = useMemo(() => paymentTotals(payments), [payments])
  const identityName = identityLabel(identity)
  const readiness = dashPayReadiness(identity)

  if (contact == null) {
    return (
      <div className={CONTACT_DETAIL_ROOT_CLASS}>
        <PageHeader title={CONTACT_MENU_COPY.title} onBack={onBack} backLabel={PAGE_HEADERS.dashpayContact.back} />
        {loading ? (
          <ListSkeleton rows={CONTACT_PAYMENTS_SKELETON_ROWS} rowClassName={CONTACT_PAYMENT_SKELETON_CLASS} />
        ) : (
          <NoResults
            noResults={CONTACT_DETAIL_COPY.unavailable}
            action={<Button type={'button'} size={'compact'} colorScheme={'primary'} onClick={onBack}>{CONTACT_DETAIL_COPY.backToContacts}</Button>}
          />
        )}
      </div>
    )
  }

  const name = contactDisplayName(contact)
  const username = contact.usernames[0] ?? null
  const otherNames = contactOtherNames(contact.usernames, CONTACT_OTHER_NAMES_LIMIT)
  const payable = isPayable(contact)
  const incoming = contact.relationship === DashPayContactRelationship.Incoming
  const canAccept = incoming && !contact.paymentChannelBroken && readiness.canSend
  const isWalletIdentity = identities.some(entry => entry.identifier === contact.contactId)
  const openPay = (): void => setModal({ action: ContactAction.Pay, contact, open: true })
  const totalsPending = paymentsLoading && payments.length === 0

  const amountValue = (duffs: bigint, accent: boolean): React.JSX.Element => {
    if (totalsPending) return <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{CONTACT_DETAIL_COPY.missingValue}</Text>
    return (
      <SensitiveValue hidden={!isBalanceVisible} size={'card'} tone={accent ? 'accent' : 'default'}>
        <Text size={14} weight={'medium'} color={'brand'}>
          <span className={`font-extrabold ${accent ? 'dash-text-primary' : ''}`}>
            <DashBigNumber>{davToDash(duffs)}</DashBigNumber>
          </span>
          {` ${DASH_UNIT}`}
        </Text>
      </SensitiveValue>
    )
  }

  return (
    <div className={CONTACT_DETAIL_ROOT_CLASS}>
      <PageHeader
        title={<span className={'[overflow-wrap:anywhere]'}>{name}</span>}
        onBack={onBack}
        backLabel={PAGE_HEADERS.dashpayContact.back}
        titleAddon={<CustomBadge {...RELATIONSHIP_BADGES[contact.relationship]} className={'shrink-0 whitespace-nowrap'} />}
        subtitle={
          <span className={'inline-flex flex-wrap items-center gap-2 wrap-anywhere'}>
            {contactDetailSubtitle(contact, identityName, now)}
            {isWalletIdentity && (
              <button type={'button'} onClick={() => onActAs(contact.contactId)} className={`${CHIP_ACTION} max-w-60 truncate`}>
                {username == null ? CONTACT_DETAIL_COPY.actAsThis : `${CONTACT_DETAIL_COPY.actAs} ${username}`}
              </button>
            )}
          </span>
        }
        actions={
          <>
            <ActingIdentityChip identity={identity} />
            {canAccept && (
              <Button type={'button'} size={'compact'} colorScheme={'primary'} className={'h-8!'} onClick={() => setModal({ action: ContactAction.Accept, contact, open: true })}>
                {CONTACT_DETAIL_COPY.accept}
              </Button>
            )}
            {payable && (
              <Button type={'button'} size={'compact'} colorScheme={'primary'} className={'h-8!'} onClick={openPay}>
                {CONTACT_DETAIL_COPY.pay}
              </Button>
            )}
          </>
        }
      />

      <div className={'flex flex-col gap-4'}>
        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={'flex min-w-0 items-center gap-3'}>
            <IdentityAvatar identifier={contact.contactId} size={IdentityAvatarSize.Md} />
            <div className={'flex min-w-0 flex-1 flex-col gap-1'}>
              {username != null && <Text reset size={16} weight={'bold'} color={'brand'} className={'min-w-0 truncate'}>{username}</Text>}
              {otherNames != null && (
                <Text reset size={12} weight={'medium'} color={'brand'} opacity={50} className={'min-w-0 truncate'}>{otherNames}</Text>
              )}
              <div className={'flex min-w-0 items-center gap-[.3125rem]'}>
                <HighlightedIdentifier className={TRANSACTION_DETAIL_IDENTIFIER_CLASS}>{contact.contactId}</HighlightedIdentifier>
                <CopyButton text={contact.contactId} className={'shrink-0'} />
                {network != null && (
                  <button
                    type={'button'}
                    onClick={() => openExternal(identityUrl(contact.contactId, network))}
                    title={CONTACT_DETAIL_COPY.openInExplorer}
                    aria-label={CONTACT_DETAIL_COPY.openInExplorer}
                    className={EXPLORER_ICON_BUTTON_CLASS}
                  >
                    <ExternalLinkIcon size={10} color={'currentColor'} className={'dash-text-default opacity-50'} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className={'grid grid-cols-1 lg:grid-cols-2 gap-3'}>
            <TransactionDetailToken
              icon={<ReceiveIcon size={12} color={'currentColor'} className={CONTACT_TOKEN_ICON_CLASS} />}
              label={CONTACT_DETAIL_COPY.theyAdded}
              value={requestDate(contact.incomingCreatedAt)}
              subValue={contact.incomingCreatedAt != null && <TimeDelta endDate={new Date(contact.incomingCreatedAt)} />}
            />
            <TransactionDetailToken
              icon={<SendIcon size={12} color={'currentColor'} className={CONTACT_TOKEN_ICON_CLASS} />}
              label={CONTACT_DETAIL_COPY.youAdded}
              value={requestDate(contact.outgoingCreatedAt)}
              subValue={contact.outgoingCreatedAt != null && <TimeDelta endDate={new Date(contact.outgoingCreatedAt)} />}
            />
            <TransactionDetailToken
              icon={<SendIcon size={12} color={'currentColor'} className={CONTACT_TOKEN_ICON_CLASS} />}
              label={CONTACT_DETAIL_COPY.sent}
              value={amountValue(totals.sent, false)}
            />
            <TransactionDetailToken
              icon={<ReceiveIcon size={12} color={'currentColor'} className={CONTACT_TOKEN_ICON_CLASS} />}
              label={CONTACT_DETAIL_COPY.received}
              value={amountValue(totals.received, true)}
            />
          </div>
        </div>

        {contact.paymentChannelBroken && (
          <Alert
            tone={AlertTone.Warning}
            icon={<ExclamationIcon size={16} color={'currentColor'} />}
            title={CONTACT_DETAIL_COPY.brokenTitle}
            description={brokenChannelDescription(name)}
          />
        )}

        <ContactPayments
          walletId={walletId}
          identity={identity}
          contact={contact}
          visibleCount={paymentsVisibleCount}
          onShowMore={onShowMorePayments}
          onPay={payable ? openPay : null}
        />
      </div>

      <ContactActionModals modal={modal} contacts={mine} identity={identity} onModalChange={setModal} />
    </div>
  )
}
