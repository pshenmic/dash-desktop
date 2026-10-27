import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { DashPayContactDto } from '@renderer/api/types'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { DASHPAY_LOAD_ERRORS, DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import {
  CONTACT_LIST_CLASS,
  CONTACT_LIST_SKELETON_ROWS,
  CONTACT_ROW_SKELETON_CLASS,
  CONTACT_SEARCH_SKELETON_ROWS,
  CONTACT_SEGMENT_EMPTY,
  CONTACTS_TAB_COPY,
} from '@renderer/constants/dashPayContacts'
import { LIST_GROUP_LABEL_CLASS } from '@renderer/constants/listToolbar'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { ContactAction, ContactSegment } from '@renderer/enums/DashPay'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { refreshDashPayContacts, useDashPayContacts } from '@renderer/hooks/useDashPayContacts'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import { useWalletIdentifiers } from '@renderer/hooks/useWalletIdentifiers'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { ContactModalState } from '@renderer/types/DashPayContacts'
import type { ContactsTabProps } from '@renderer/types/DashPayScreens'
import { contactRowModel, contactsForIdentity, countContactSegments, filterContacts, groupContactRows } from '@renderer/utils/dashPayContactList'
import { contactGroupLabel, contactsNoMatchLabel, showInAllLabel } from '@renderer/utils/dashPayContactView'
import { dashPayHref } from '@renderer/utils/dashPayIdentity'
import { identityName } from '@renderer/utils/identifierFormat'
import { windowGroups } from '@renderer/utils/listWindow'
import EnableDashPayModal from '../keys/EnableDashPayModal'
import ReadinessAlert from '../keys/ReadinessAlert'
import ContactActionModals from './ContactActionModals'
import ContactRow from './ContactRow'
import ContactsToolbar, { AddContactButton } from './ContactsToolbar'

export default function ContactsTab({
  walletId,
  identity,
  identities,
  readiness,
  now,
  segment,
  onSegmentChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  visibleCount,
  onShowMore,
  onOpenContact,
}: ContactsTabProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { contacts, loading, err } = useDashPayContacts(walletId)
  const [modal, setModal] = useState<ContactModalState | null>(null)
  const [enableOpen, setEnableOpen] = useState(false)
  const deferredQuery = useDeferredValue(query)
  const searching = deferredQuery !== query

  const mine = useMemo(() => contactsForIdentity(contacts, identity.identifier), [contacts, identity.identifier])
  const walletIdentifiers = useWalletIdentifiers(identities)
  const counts = useMemo(() => countContactSegments(mine, deferredQuery), [mine, deferredQuery])
  const groups = useMemo(() => groupContactRows(filterContacts(mine, deferredQuery), segment, sort), [mine, deferredQuery, segment, sort])
  const view = useMemo(() => windowGroups(groups, visibleCount), [groups, visibleCount])
  const showMore = view.hasMore && !searching
  const sentinelRef = useScrollEndSentinel(showMore, onShowMore, visibleCount)

  const openAddContact = (): void => {
    const navigationState: DashPayNavigationState = { returnTo: location.pathname + location.search }
    navigate(dashPayHref(DASHPAY_ROUTES.addContact, identity.identifier), { state: navigationState })
  }
  const openModal = (action: ContactAction) => (contact: DashPayContactDto): void => setModal({ action, contact, open: true })

  if (loading && contacts.length === 0) {
    return <ListSkeleton rows={CONTACT_LIST_SKELETON_ROWS} rowClassName={CONTACT_ROW_SKELETON_CLASS} />
  }

  if (err != null && contacts.length === 0) {
    return (
      <NoResults
        tone={NoResultsTone.Error}
        noResults={DASHPAY_LOAD_ERRORS.contacts}
        action={<RetryButton onRetry={() => refreshDashPayContacts(walletId)} />}
      />
    )
  }

  const segmentCount = counts[segment]
  let body: React.JSX.Element
  if (searching) {
    body = <ListSkeleton rows={CONTACT_SEARCH_SKELETON_ROWS} rowClassName={CONTACT_ROW_SKELETON_CLASS} />
  } else if (segmentCount === 0 && deferredQuery.trim() !== '') {
    body = (
      <NoResults
        noResults={contactsNoMatchLabel(deferredQuery.trim(), identityName(identity))}
        action={
          <div className={'flex items-center gap-2'}>
            <button type={'button'} onClick={() => onQueryChange('')} className={CHIP_ACTION}>{CONTACTS_TAB_COPY.clearSearch}</button>
            {segment !== ContactSegment.All && counts[ContactSegment.All] > 0 && (
              <button type={'button'} onClick={() => onSegmentChange(ContactSegment.All)} className={CHIP_ACTION}>
                {showInAllLabel(counts[ContactSegment.All])}
              </button>
            )}
          </div>
        }
      />
    )
  } else if (segmentCount === 0) {
    body = <NoResults noResults={CONTACT_SEGMENT_EMPTY[segment]} />
  } else {
    body = (
      <div className={CONTACT_LIST_CLASS}>
        {view.groups.map(group => (
          <Fragment key={group.key}>
            {group.label != null && (
              <Text as={'h3'} reset size={10} weight={'medium'} color={'brand'} opacity={40} className={LIST_GROUP_LABEL_CLASS}>
                {contactGroupLabel(group.label, group.total)}
              </Text>
            )}
            <ul aria-label={group.label ?? undefined} className={'contents'}>
              {group.items.map(contact => (
                <ContactRow
                  key={contact.contactId}
                  model={contactRowModel(contact, walletIdentifiers)}
                  now={now}
                  canSend={readiness.canSend}
                  onOpen={onOpenContact}
                  onAccept={openModal(ContactAction.Accept)}
                  onPay={openModal(ContactAction.Pay)}
                />
              ))}
            </ul>
          </Fragment>
        ))}
        {showMore && <ShowMoreButton ref={sentinelRef} remaining={view.remaining} onClick={onShowMore} />}
      </div>
    )
  }

  return (
    <div className={'flex flex-col gap-4'}>
      <ReadinessAlert identity={identity} readiness={readiness} onEnable={() => setEnableOpen(true)} />
      {mine.length === 0 ? (
        <NoResults
          title={CONTACTS_TAB_COPY.emptyTitle}
          description={CONTACTS_TAB_COPY.emptyDescription}
          action={<AddContactButton canAdd={readiness.canSend} onAdd={openAddContact} />}
        />
      ) : (
        <>
          <ContactsToolbar
            query={query}
            onQueryChange={onQueryChange}
            sort={sort}
            onSortChange={onSortChange}
            segment={segment}
            onSegmentChange={onSegmentChange}
            counts={counts}
            canAdd={readiness.canSend}
            onAdd={openAddContact}
          />
          <div aria-busy={searching}>{body}</div>
        </>
      )}
      <EnableDashPayModal open={enableOpen} onClose={() => setEnableOpen(false)} identity={identity} />
      <ContactActionModals modal={modal} contacts={mine} identity={identity} onModalChange={setModal} />
    </div>
  )
}
