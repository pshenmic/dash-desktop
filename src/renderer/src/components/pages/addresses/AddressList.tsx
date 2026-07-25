import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from 'dash-ui-kit/react'
import { addressesPage } from '@renderer/constants'
import AddressCard from './AddressCard'
import PlatformAddressCard from './PlatformAddressCard'
import ShieldedAddressTab from './ShieldedAddressTab'
import PlatformUnlockTab from './PlatformUnlockTab'
import AddAddressSection from './AddAddressSection'
import SyncGateNotice from '@renderer/components/ui/SyncGateNotice'
import { useAdresses } from '@renderer/hooks/useAdresses'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { useAuth } from '@renderer/contexts/AuthContext'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import { WalletAddressDto } from '@renderer/api/types'

function TabContent<T>({
  items,
  loading,
  err,
  errorMessage,
  emptyMessage,
  renderItem,
}: {
  items: T[]
  loading: boolean
  err: string | null
  errorMessage: string
  emptyMessage: string
  renderItem: (item: T) => React.JSX.Element
}): React.JSX.Element {
  if (loading) {
    return <ListSkeleton rows={6} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (err) {
    return <NoResults noResults={errorMessage} />
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
  const { receiving, change, loading, err } = useAdresses(status?.selectedWalletId ?? undefined)
  const {
    platformAddresses,
    loading: platformLoading,
    err: platformErr,
  } = usePlatformAddresses(status?.selectedWalletId ?? undefined)

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
          />
          <AddAddressSection walletId={status?.selectedWalletId ?? undefined} kind={"receiving"} />
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
          />
          <AddAddressSection walletId={status?.selectedWalletId ?? undefined} kind={"change"} />
        </div>
      ),
    },
    {
      value: 'platform',
      label: tabs.platform,
      content: !platformLoading && !platformErr && platformAddresses.length === 0 ? (
        <PlatformUnlockTab walletId={status?.selectedWalletId ?? undefined} />
      ) : (
        <div className={"flex flex-col gap-[.625rem]"}>
          <TabContent
            items={platformAddresses}
            loading={platformLoading}
            err={platformErr}
            errorMessage={"Failed to load platform addresses"}
            emptyMessage={"No platform addresses found"}
            renderItem={(item) => <PlatformAddressCard key={item.platformAddress} {...item} />}
          />
          {!platformLoading && !platformErr && (
            <AddAddressSection walletId={status?.selectedWalletId ?? undefined} kind={"platform"} />
          )}
        </div>
      ),
    },
    {
      value: 'shielded',
      label: tabs.shielded,
      content: <ShieldedAddressTab walletId={status?.selectedWalletId ?? undefined} />,
    },
  ]

  return (
    <div className={"px-12 pb-8"}>
      <div className={`
        relative
        flex
        p-[.9375rem]
        rounded-3xl
        dash-card-base
        shadow-[0_0_32px_0_rgba(12,28,51,0.08)]
      `}>
        <Tabs
          items={tabItems}
          value={activeTab}
          onValueChange={setActiveTab}
          size={"xl"}
          triggerClassName={
            'data-[state=active]:text-dash-primary-dark-blue ' +
            'data-[state=inactive]:text-dash-primary-dark-blue/35 ' +
            'dark:data-[state=active]:text-white ' +
            'dark:data-[state=inactive]:text-white/35 ' +
            'font-medium tracking-[-0.03em]'
          }
        />
      </div>
    </div>
  )
}
