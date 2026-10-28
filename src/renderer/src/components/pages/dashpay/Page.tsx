import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ContactDetail from '@renderer/components/pages/dashpay/contacts/ContactDetail'
import ContactsTab from '@renderer/components/pages/dashpay/contacts/ContactsTab'
import OverviewTab from '@renderer/components/pages/dashpay/overview/OverviewTab'
import UsernamesTab from '@renderer/components/pages/dashpay/usernames/UsernamesTab'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import PageTabs from '@renderer/components/ui/PageTabs'
import RetryButton from '@renderer/components/ui/RetryButton'
import { toast } from '@renderer/components/ui/Toast'
import {
  DASHPAY_CONTACTS_PAGE_SIZE,
  DASHPAY_PARAMS,
  DASHPAY_PAYMENTS_PAGE_SIZE,
  DASHPAY_REFRESH_MS,
  DASHPAY_TAB_LABELS,
} from '@renderer/constants/dashPay'
import { OVERVIEW_COPY } from '@renderer/constants/dashPayOverview'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SCROLL_CONTAINER_ID } from '@renderer/constants/scrollIndicator'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import { ActiveIdentitySource, ContactSegment, ContactSort, DashPayTab } from '@renderer/enums/DashPay'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { useActiveIdentity } from '@renderer/hooks/useActiveIdentity'
import { useDashPayContacts } from '@renderer/hooks/useDashPayContacts'
import { refreshDashPay } from '@renderer/hooks/useDashPayRefresh'
import { useDetailScrollRestore } from '@renderer/hooks/useDetailScrollRestore'
import { useNow } from '@renderer/hooks/useNow'
import type { DashPayPageProps } from '@renderer/types/DashPayScreens'
import type { IdentitySelectHandle } from '@renderer/types/IdentitySelect'
import { identityLabel } from '@renderer/utils/identifierFormat'
import { enumParam, withParams } from '@renderer/utils/searchParams'
import IdentitySwitcher from './IdentitySwitcher'

export default function DashPayPage({ walletId }: DashPayPageProps): React.JSX.Element {
  const { identities, identity, readiness, source, loading, err, retry, select } = useActiveIdentity()
  const { contacts } = useDashPayContacts(walletId)
  const [searchParams, setSearchParams] = useSearchParams()
  const now = useNow()
  const switcherRef = useRef<IdentitySelectHandle>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const lastExplicit = useRef<string | null>(null)
  const warned = useRef(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(ContactSort.Recent)
  const [visibleCount, setVisibleCount] = useState(DASHPAY_CONTACTS_PAGE_SIZE)
  const [paymentsVisibleCount, setPaymentsVisibleCount] = useState(DASHPAY_PAYMENTS_PAGE_SIZE)
  const [announcement, setAnnouncement] = useState('')

  const requestedTab = enumParam(DashPayTab, searchParams.get(DASHPAY_PARAMS.tab), DashPayTab.Overview)
  const tab = identity == null || readiness == null ? DashPayTab.Overview : requestedTab
  const segment = enumParam(ContactSegment, searchParams.get(DASHPAY_PARAMS.segment), ContactSegment.All)
  const contactId = searchParams.get(DASHPAY_PARAMS.contact)
  const saveListScroll = useDetailScrollRestore(contactId != null && identity != null ? contactId : null)

  useEffect(() => {
    const timer = setInterval(() => { refreshDashPay(walletId).catch(() => {}) }, DASHPAY_REFRESH_MS)
    return () => clearInterval(timer)
  }, [walletId])

  useEffect(() => {
    if (loading || err != null || identity == null) return
    if (source === ActiveIdentitySource.Requested || source === ActiveIdentitySource.Stored) {
      lastExplicit.current = identity.identifier
      return
    }
    const previous = lastExplicit.current
    if (warned.current || previous == null || identities.some(entry => entry.identifier === previous)) return
    warned.current = true
    toast.warning(`${OVERVIEW_COPY.identityUnavailable} ${identityLabel(identity)} ${OVERVIEW_COPY.instead}`)
  }, [loading, err, identity, identities, source])

  const chooseIdentity = (identifier: string): void => {
    select(identifier)
    const next = identities.find(entry => entry.identifier === identifier)
    if (next != null) setAnnouncement(`${OVERVIEW_COPY.actingAs} ${identityLabel(next)}`)
    setVisibleCount(DASHPAY_CONTACTS_PAGE_SIZE)
    setPaymentsVisibleCount(DASHPAY_PAYMENTS_PAGE_SIZE)
    const panel = panelRef.current
    const container = document.getElementById(SCROLL_CONTAINER_ID)
    if (panel != null && container != null && panel.getBoundingClientRect().top < container.getBoundingClientRect().top) {
      panel.scrollIntoView({ block: 'start' })
    }
  }

  const switchIdentity = (): void => switcherRef.current?.open()

  const changeTab = (value: string): void => {
    const next = enumParam(DashPayTab, value, DashPayTab.Overview)
    setSearchParams(
      prev => withParams(prev, { [DASHPAY_PARAMS.tab]: next === DashPayTab.Overview ? null : next }),
      { replace: true }
    )
  }

  const openSection = (next: DashPayTab, nextSegment?: ContactSegment): void => {
    setSearchParams(
      prev => withParams(prev, { [DASHPAY_PARAMS.tab]: next, [DASHPAY_PARAMS.segment]: nextSegment }),
      { replace: true }
    )
  }

  const changeSegment = (next: ContactSegment): void => {
    setSearchParams(prev => withParams(prev, { [DASHPAY_PARAMS.segment]: next }), { replace: true })
  }

  const changeQuery = (next: string): void => {
    setQuery(next)
    setVisibleCount(DASHPAY_CONTACTS_PAGE_SIZE)
  }

  const changeSort = (next: ContactSort): void => {
    setSort(next)
    setVisibleCount(DASHPAY_CONTACTS_PAGE_SIZE)
  }

  const openContact = (next: string): void => {
    setPaymentsVisibleCount(DASHPAY_PAYMENTS_PAGE_SIZE)
    setSearchParams(prev => withParams(prev, { [DASHPAY_PARAMS.contact]: next }))
  }

  const closeContact = (): void => {
    setSearchParams(prev => withParams(prev, { [DASHPAY_PARAMS.contact]: null }), { replace: true })
  }

  const liveRegion = <span className={'sr-only'} aria-live={'polite'}>{announcement}</span>

  if (contactId != null && identity != null) {
    return (
      <div className={'flex flex-col'}>
        {liveRegion}
        <ContactDetail
          walletId={walletId}
          identity={identity}
          identities={identities}
          contactId={contactId}
          now={now}
          paymentsVisibleCount={paymentsVisibleCount}
          onShowMorePayments={() => setPaymentsVisibleCount(count => count + DASHPAY_PAYMENTS_PAGE_SIZE)}
          onBack={closeContact}
          onActAs={chooseIdentity}
        />
      </div>
    )
  }

  const failed = err != null && identities.length === 0
  const tabsDisabled = identity == null || readiness == null
  const body = (content: React.ReactNode): React.ReactNode => (
    <div key={identity?.identifier ?? 'none'} className={'phase-fade-in'}>{content}</div>
  )

  const overview = failed ? (
    <NoResults tone={NoResultsTone.Error} noResults={OVERVIEW_COPY.loadFailed} action={<RetryButton onRetry={retry} />} />
  ) : (
    <OverviewTab
      walletId={walletId}
      identity={identity}
      identities={identities}
      readiness={readiness}
      loading={loading}
      now={now}
      onSwitchIdentity={switchIdentity}
      onOpenSection={openSection}
    />
  )

  const items = [
    { value: DashPayTab.Overview, label: DASHPAY_TAB_LABELS[DashPayTab.Overview], content: body(overview) },
    {
      value: DashPayTab.Contacts,
      label: DASHPAY_TAB_LABELS[DashPayTab.Contacts],
      disabled: tabsDisabled,
      content: identity != null && readiness != null && body(
        <ContactsTab
          walletId={walletId}
          identity={identity}
          identities={identities}
          readiness={readiness}
          now={now}
          segment={segment}
          onSegmentChange={changeSegment}
          query={query}
          onQueryChange={changeQuery}
          sort={sort}
          onSortChange={changeSort}
          visibleCount={visibleCount}
          onShowMore={() => setVisibleCount(count => count + DASHPAY_CONTACTS_PAGE_SIZE)}
          onOpenContact={openContact}
        />
      ),
    },
    {
      value: DashPayTab.Usernames,
      label: DASHPAY_TAB_LABELS[DashPayTab.Usernames],
      disabled: tabsDisabled,
      content: identity != null && readiness != null && body(
        <UsernamesTab walletId={walletId} identity={identity} readiness={readiness} now={now} />
      ),
    },
  ]

  return (
    <div className={'relative flex flex-col pb-12'}>
      {liveRegion}
      <div className={'px-12'}>
        <PageHeader
          title={PAGE_HEADERS.dashpay.title}
          subtitle={PAGE_HEADERS.dashpay.subtitle}
          actions={(loading || err != null || identities.length > 0) && (
            <IdentitySwitcher
              ref={switcherRef}
              identities={identities}
              identity={identity}
              contacts={contacts}
              loading={loading}
              err={err}
              onRetry={retry}
              onSelect={chooseIdentity}
            />
          )}
        />
        <div ref={panelRef} onClickCapture={saveListScroll} className={`relative ${SURFACE_PANEL}`}>
          <PageTabs items={items} value={tab} onValueChange={changeTab} />
        </div>
      </div>
    </div>
  )
}
