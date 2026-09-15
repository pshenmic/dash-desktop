import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { Text, Input, SearchIcon } from '@renderer/components/dash-ui-kit-enxtended'
import DropdownField from '@renderer/components/ui/DropdownField'
import { useIdentities } from '@renderer/hooks/useIdentities'
import { addressKey, matchesAddressUsage } from '@renderer/utils/addressBook'
import { ADDRESS_USAGE_OPTIONS } from '@renderer/constants/addressBook'
import type { AddressListProps, AddressUsage } from '@renderer/types/AddressBook'

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

export default function AddressList({ coreGated = false, contacts = [], onSaveAddress }: AddressListProps): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = requestedTab && TAB_VALUES.includes(requestedTab) ? requestedTab : coreGated ? 'platform' : 'receiving'
  const usage = (ADDRESS_USAGE_OPTIONS.find(item => item.value === searchParams.get('usage'))?.value ?? 'all') as AddressUsage
  const [search, setSearch] = useState('')
  const updateFilter = (key: string, value: string): void => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      next.set('tab', activeTab)
      next.set(key, value)
      return next
    })
  }
  const { tabs } = addressesPage
  const { status } = useAuth()
  const identities = useIdentities(status?.selectedWalletId ?? undefined)
  const { receiving, change, loading, err } = useAdresses(status?.selectedWalletId ?? undefined)
  const {
    platformAddresses,
    loading: platformLoading,
    err: platformErr,
  } = usePlatformAddresses(status?.selectedWalletId ?? undefined)

  const saveAction = (address: string): React.JSX.Element | null => {
    if (!onSaveAddress) return null
    const saved = contacts.find(contact => addressKey(contact.address) === addressKey(address))
    return <button type="button" disabled={!!saved} onClick={() => onSaveAddress(address)} title={saved?.label} className="text-xs dash-text-primary cursor-pointer disabled:opacity-50 shrink-0 px-3 py-2">{saved ? 'Saved' : '+ Save to book'}</button>
  }
  const visible = (address: string, balance: bigint | null, used: boolean): boolean => matchesAddressUsage(usage, balance, used)
    && (!search.trim() || `${address} ${contacts.find(contact => addressKey(contact.address) === addressKey(address))?.label ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const renderAddress = (item: WalletAddressDto): React.JSX.Element => <div key={item.address} className="flex items-center gap-2"><div className="flex-1 min-w-0 overflow-x-auto"><AddressCard {...item} /></div>{saveAction(item.address)}</div>

  const tabItems = [
    {
      value: 'receiving',
      label: tabs.receiving,
      content: coreGated ? <SyncGateNotice /> : (
        <div className={"flex flex-col gap-[.625rem]"}>
          <TabContent
            items={receiving.filter(item => visible(item.address, item.balance, item.isUsed || item.txCount > 0 || item.balance > 0n))}
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
            items={change.filter(item => visible(item.address, item.balance, item.isUsed || item.txCount > 0 || item.balance > 0n))}
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
            items={platformAddresses.filter(item => visible(item.platformAddress, item.balanceCredits, item.nonce > 0 || item.balanceCredits > 0n))}
            loading={platformLoading}
            err={platformErr}
            errorMessage={"Failed to load platform addresses"}
            emptyMessage={"No platform addresses found"}
            renderItem={(item) => <div key={item.platformAddress} className="flex items-center gap-2"><div className="flex-1 min-w-0 overflow-x-auto"><PlatformAddressCard {...item} /></div>{saveAction(item.platformAddress)}</div>}
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
      content: <ShieldedAddressTab walletId={status?.selectedWalletId ?? undefined} usage={usage} search={search} contacts={contacts} renderAction={saveAction} />,
    },
  ]

  return (
    <div className={"px-12 pb-8"}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1"><Input type="search" size="sm" colorScheme="light" variant="filled" aria-label="Search wallet addresses" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search addresses or saved names" prefix={<SearchIcon size={14} color="currentColor" className="dash-text-default" />} /></div>
        <DropdownField options={ADDRESS_USAGE_OPTIONS} value={usage} onChange={value => updateFilter('usage', value)} ariaLabel="Address usage" triggerClassName="dash-block dash-black-border rounded-[.625rem] px-3 py-2" />
      </div>
      {activeTab === 'platform' && !identities.loading && !identities.err && identities.identities.some(item => item.balance.amount > 0n) && <div role="status" className="mb-4 flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] border border-dash-brand/35 bg-dash-brand/8 dark:border-dash-mint/40 dark:bg-dash-mint/10">
        <Text size={12} weight="medium" color="brand">You also have identities with a balance. Their funds are included in Platform Balance.</Text>
        <Link to="/identities" className="shrink-0 text-sm dash-text-primary">View identities →</Link>
      </div>}
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
          onValueChange={value => updateFilter('tab', value)}
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
