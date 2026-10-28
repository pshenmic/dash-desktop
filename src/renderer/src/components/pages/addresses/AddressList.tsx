import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageTabs from '@renderer/components/ui/PageTabs'
import { addressesPage } from '@renderer/constants'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import AddressCard from './AddressCard'
import PlatformAddressCard from './PlatformAddressCard'
import ShieldedAddressTab from './ShieldedAddressTab'
import PlatformUnlockTab from './PlatformUnlockTab'
import AddAddressSection from './AddAddressSection'
import SyncGateNotice from '@renderer/components/ui/SyncGateNotice'
import { refreshAddresses, useAdresses } from '@renderer/hooks/useAdresses'
import { refreshPlatformAddresses, usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { useAuth } from '@renderer/contexts/AuthContext'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import type { RetryButtonProps } from '@renderer/types/RetryButton'
import { WalletAddressDto } from '@renderer/api/types'

function TabContent<T>({
  items,
  loading,
  err,
  errorMessage,
  emptyMessage,
  renderItem,
  onRetry,
}: {
  items: T[]
  loading: boolean
  err: string | null
  errorMessage: string
  emptyMessage: string
  renderItem: (item: T) => React.JSX.Element
  onRetry?: RetryButtonProps['onRetry']
}): React.JSX.Element {
  if (loading) {
    return <ListSkeleton rows={6} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (err) {
    return (
      <NoResults
        tone={NoResultsTone.Error}
        noResults={errorMessage}
        action={onRetry && <RetryButton onRetry={onRetry} />}
      />
    )
  }

  if (items.length === 0) {
    return <NoResults noResults={emptyMessage} />
  }

  return (
    <div className={"flex flex-col gap-[.625rem]"}>
      {items.map(renderItem)}
    </div>
  )
}

const TAB_VALUES = ['receiving', 'change', 'platform', 'shielded']

export default function AddressList({ coreGated = false }: { coreGated?: boolean }): React.JSX.Element {
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    requestedTab !== null && TAB_VALUES.includes(requestedTab)
      ? requestedTab
      : coreGated ? 'platform' : 'receiving'
  )
  const { tabs } = addressesPage
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const { receiving, change, loading, err } = useAdresses(walletId)
  const {
    platformAddresses,
    loading: platformLoading,
    err: platformErr,
  } = usePlatformAddresses(walletId)
  const retryAddresses = walletId === undefined ? undefined : () => refreshAddresses(walletId)
  const retryPlatformAddresses = walletId === undefined ? undefined : () => refreshPlatformAddresses(walletId)

  const renderAddress = (item: WalletAddressDto): React.JSX.Element => <AddressCard key={item.address} {...item} />

  const tabItems = [
    {
      value: 'receiving',
      label: tabs.receiving,
      content: coreGated ? <SyncGateNotice /> : (
        <div className={"flex flex-col gap-[.625rem]"}>
          <TabContent
            items={receiving}
            loading={loading}
            err={err}
            errorMessage={"Failed to load addresses"}
            emptyMessage={"No addresses found"}
            renderItem={renderAddress}
            onRetry={retryAddresses}
          />
          <AddAddressSection walletId={walletId} kind={"receiving"} />
        </div>
      ),
    },
    {
      value: 'change',
      label: tabs.change,
      content: coreGated ? <SyncGateNotice /> : (
        <div className={"flex flex-col gap-[.625rem]"}>
          <TabContent
            items={change}
            loading={loading}
            err={err}
            errorMessage={"Failed to load addresses"}
            emptyMessage={"No addresses found"}
            renderItem={renderAddress}
            onRetry={retryAddresses}
          />
          <AddAddressSection walletId={walletId} kind={"change"} />
        </div>
      ),
    },
    {
      value: 'platform',
      label: tabs.platform,
      content: !platformLoading && !platformErr && platformAddresses.length === 0 ? (
        <PlatformUnlockTab walletId={walletId} />
      ) : (
        <div className={"flex flex-col gap-[.625rem]"}>
          <TabContent
            items={platformAddresses}
            loading={platformLoading}
            err={platformErr}
            errorMessage={"Failed to load platform addresses"}
            emptyMessage={"No platform addresses found"}
            renderItem={(item) => <PlatformAddressCard key={item.platformAddress} {...item} />}
            onRetry={retryPlatformAddresses}
          />
          {!platformLoading && !platformErr && (
            <AddAddressSection walletId={walletId} kind={"platform"} />
          )}
        </div>
      ),
    },
    {
      value: 'shielded',
      label: tabs.shielded,
      content: <ShieldedAddressTab walletId={walletId} />,
    },
  ]

  return (
    <div className={"px-12 pb-8"}>
      <div className={`relative flex ${SURFACE_PANEL}`}>
        <PageTabs
          items={tabItems}
          value={activeTab}
          onValueChange={setActiveTab}
        />
      </div>
    </div>
  )
}
