import { useMemo } from 'react'
import { DateBlock } from 'dash-ui-kit/react'
import { Button } from '@renderer/components/dash-ui-kit-extended'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import TransactionCard from '@renderer/components/pages/transactions/TransactionCard'
import { ContextMenu } from '@renderer/components/ui/ContextMenu'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { DASHPAY_LOAD_ERRORS } from '@renderer/constants/dashPay'
import {
  CONTACT_DETAIL_COPY,
  CONTACT_PAYMENT_SKELETON_CLASS,
  CONTACT_PAYMENTS_COPY,
  CONTACT_PAYMENTS_SKELETON_ROWS,
} from '@renderer/constants/dashPayContacts'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { refreshDashPayPayments, useDashPayPayments } from '@renderer/hooks/useDashPayPayments'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import type { ContextMenuItem } from '@renderer/types/ContextMenu'
import type { ContactPaymentsProps } from '@renderer/types/DashPayContacts'
import { copyWithToast } from '@renderer/utils/clipboard'
import { dashPayPaymentCard } from '@renderer/utils/dashPayPayments'
import { openExternal, transactionUrl } from '@renderer/utils/explorer'
import { windowDayGroups } from '@renderer/utils/listWindow'

export default function ContactPayments({
  walletId,
  identity,
  contact,
  visibleCount,
  onShowMore,
  onPay,
}: ContactPaymentsProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const { payments, loading, err } = useDashPayPayments(walletId, identity.identifier, contact.contactId)
  const view = useMemo(() => windowDayGroups(payments, payment => payment.date, visibleCount), [payments, visibleCount])
  const sentinelRef = useScrollEndSentinel(view.hasMore, onShowMore, visibleCount)

  const menuItems = (txid: string): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [{
      id: 'copy-txid',
      label: CONTACT_PAYMENTS_COPY.copyTxid,
      onSelect: () => copyWithToast(txid),
    }]
    if (network != null) {
      items.push({ id: 'explorer', label: CONTACT_PAYMENTS_COPY.openInExplorer, onSelect: () => openExternal(transactionUrl(txid, network)) })
    }
    return items
  }

  let body: React.JSX.Element
  if (loading && payments.length === 0) {
    body = <ListSkeleton rows={CONTACT_PAYMENTS_SKELETON_ROWS} rowClassName={CONTACT_PAYMENT_SKELETON_CLASS} />
  } else if (err != null && payments.length === 0) {
    body = (
      <NoResults
        tone={NoResultsTone.Error}
        noResults={DASHPAY_LOAD_ERRORS.payments}
        action={<RetryButton onRetry={() => refreshDashPayPayments(walletId, identity.identifier, contact.contactId)} />}
      />
    )
  } else if (payments.length === 0) {
    body = (
      <NoResults
        title={CONTACT_PAYMENTS_COPY.empty}
        action={onPay && <Button type={'button'} size={'compact'} colorScheme={'primary'} onClick={onPay}>{CONTACT_DETAIL_COPY.pay}</Button>}
      />
    )
  } else {
    body = (
      <>
        {view.groups.map(group => (
          <div key={group.key} className={'flex flex-col gap-[.9375rem]'}>
            <DateBlock timestamp={group.date} format={'dateOnly'} />
            {group.items.map(payment => (
              <ContextMenu key={payment.txid} title={CONTACT_PAYMENTS_COPY.menuTitle} items={menuItems(payment.txid)}>
                <div>
                  <TransactionCard {...dashPayPaymentCard(payment)} fullIdentifiers />
                </div>
              </ContextMenu>
            ))}
          </div>
        ))}
        {view.hasMore && <ShowMoreButton ref={sentinelRef} remaining={view.remaining} onClick={onShowMore} />}
      </>
    )
  }

  return (
    <section className={`flex flex-col gap-5 ${SURFACE_PANEL}`}>
      <div className={'flex items-center gap-2 px-1'}>
        <DashboardHeading as={'h2'}>{CONTACT_PAYMENTS_COPY.title}</DashboardHeading>
        {payments.length > 0 && <CustomBadge variant={'muted'} text={String(payments.length)} />}
      </div>
      {body}
    </section>
  )
}
