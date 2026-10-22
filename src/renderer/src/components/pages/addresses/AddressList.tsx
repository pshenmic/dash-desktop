import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageTabs from '@renderer/components/ui/PageTabs'
import { addressesPage } from '@renderer/constants'
import { ADDRESS_BOOK_PARAMS, WALLET_ADDRESSES_COPY } from '@renderer/constants/addressBook'
import { CHIP_ACTION, SURFACE_PANEL } from '@renderer/constants/surfaces'
import AddressCard from './AddressCard'
import PlatformAddressCard from './PlatformAddressCard'
import ShieldedAddressTab from './ShieldedAddressTab'
import PlatformUnlockTab from './PlatformUnlockTab'
import AddAddressSection from './AddAddressSection'
import WalletAddressToolbar from './WalletAddressToolbar'
import EntryEditModal from '@renderer/components/pages/addressBook/EntryEditModal'
import SyncGateNotice from '@renderer/components/ui/SyncGateNotice'
import { refreshAddresses, useAdresses } from '@renderer/hooks/useAdresses'
import { refreshPlatformAddresses, usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import { useAuth } from '@renderer/contexts/AuthContext'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import { AddressUsage, WalletAddressTab } from '@renderer/enums/AddressBook'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import type { AddressBookEditorState, WalletAddressListProps, WalletAddressTabContentProps } from '@renderer/types/AddressBook'
import { PlatformAddressDto, WalletAddressDto } from '@renderer/api/types'
import { addressBookKey, matchesAddressUsage, matchesWalletAddressQuery, savedNamesByAddress } from '@renderer/utils/addressBook'
import { isUsedCoreAddress } from '@renderer/utils/addressUsage'
import { enumParam, withParams } from '@renderer/utils/searchParams'

function TabContent<T>({
  items,
  total,
  loading,
  err,
  errorMessage,
  emptyMessage,
  renderItem,
  onRetry,
  onClearFilters,
}: WalletAddressTabContentProps<T>): React.JSX.Element {
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

  if (total === 0) {
    return <NoResults noResults={emptyMessage} />
  }

  if (items.length === 0) {
    return (
      <NoResults
        noResults={WALLET_ADDRESSES_COPY.noMatch}
        action={<button type={"button"} onClick={onClearFilters} className={CHIP_ACTION}>{WALLET_ADDRESSES_COPY.clearFilters}</button>}
      />
    )
  }

  return (
    <div className={"flex flex-col gap-[.625rem]"}>
      {items.map(renderItem)}
    </div>
  )
}

export default function AddressList({ coreGated = false }: WalletAddressListProps): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultTab = coreGated ? WalletAddressTab.Platform : WalletAddressTab.Receiving
  const activeTab = enumParam(WalletAddressTab, searchParams.get(ADDRESS_BOOK_PARAMS.tab), defaultTab)
  const usage = enumParam(AddressUsage, searchParams.get(ADDRESS_BOOK_PARAMS.usage), AddressUsage.All)
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<AddressBookEditorState | null>(null)
  const { tabs } = addressesPage
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const { receiving, change, loading, err } = useAdresses(walletId)
  const {
    platformAddresses,
    loading: platformLoading,
    err: platformErr,
  } = usePlatformAddresses(walletId)
  const { contacts } = useAddressBook()
  const savedNames = useMemo(() => savedNamesByAddress(contacts), [contacts])
  const retryAddresses = walletId === undefined ? undefined : () => refreshAddresses(walletId)
  const retryPlatformAddresses = walletId === undefined ? undefined : () => refreshPlatformAddresses(walletId)

  const changeTab = (value: string): void => {
    setSearchParams(prev => withParams(prev, { [ADDRESS_BOOK_PARAMS.tab]: enumParam(WalletAddressTab, value, defaultTab) }), { replace: true })
  }
  const changeUsage = (next: AddressUsage): void => {
    setSearchParams(prev => withParams(prev, { [ADDRESS_BOOK_PARAMS.usage]: next === AddressUsage.All ? null : next }), { replace: true })
  }
  const clearFilters = (): void => {
    setQuery('')
    changeUsage(AddressUsage.All)
  }
  const savedName = (address: string): string | undefined => savedNames.get(addressBookKey(address))
  const save = (address: string): void => setEditor({ contact: null, address })

  const coreVisible = (item: WalletAddressDto): boolean =>
    matchesAddressUsage(usage, item.balance, isUsedCoreAddress(item)) && matchesWalletAddressQuery(item.address, savedName(item.address), query)
  const platformVisible = (item: PlatformAddressDto): boolean =>
    matchesAddressUsage(usage, item.balanceCredits, item.nonce > 0 || item.balanceCredits > 0n)
    && matchesWalletAddressQuery(item.platformAddress, savedName(item.platformAddress), query)

  const toolbar = <WalletAddressToolbar query={query} onQueryChange={setQuery} usage={usage} onUsageChange={changeUsage} />
  const renderAddress = (item: WalletAddressDto): React.JSX.Element => (
    <AddressCard key={item.address} {...item} savedName={savedName(item.address)} onSave={() => save(item.address)} />
  )

  const tabItems = [
    {
      value: WalletAddressTab.Receiving,
      label: tabs.receiving,
      content: coreGated ? <SyncGateNotice /> : (
        <div className={"flex flex-col gap-[.625rem]"}>
          {toolbar}
          <TabContent
            items={receiving.filter(coreVisible)}
            total={receiving.length}
            loading={loading}
            err={err}
            errorMessage={"Failed to load addresses"}
            emptyMessage={"No addresses found"}
            renderItem={renderAddress}
            onRetry={retryAddresses}
            onClearFilters={clearFilters}
          />
          <AddAddressSection walletId={walletId} kind={"receiving"} />
        </div>
      ),
    },
    {
      value: WalletAddressTab.Change,
      label: tabs.change,
      content: coreGated ? <SyncGateNotice /> : (
        <div className={"flex flex-col gap-[.625rem]"}>
          {toolbar}
          <TabContent
            items={change.filter(coreVisible)}
            total={change.length}
            loading={loading}
            err={err}
            errorMessage={"Failed to load addresses"}
            emptyMessage={"No addresses found"}
            renderItem={renderAddress}
            onRetry={retryAddresses}
            onClearFilters={clearFilters}
          />
          <AddAddressSection walletId={walletId} kind={"change"} />
        </div>
      ),
    },
    {
      value: WalletAddressTab.Platform,
      label: tabs.platform,
      content: !platformLoading && !platformErr && platformAddresses.length === 0 ? (
        <PlatformUnlockTab walletId={walletId} />
      ) : (
        <div className={"flex flex-col gap-[.625rem]"}>
          {toolbar}
          <TabContent
            items={platformAddresses.filter(platformVisible)}
            total={platformAddresses.length}
            loading={platformLoading}
            err={platformErr}
            errorMessage={"Failed to load platform addresses"}
            emptyMessage={"No platform addresses found"}
            renderItem={(item) => (
              <PlatformAddressCard
                key={item.platformAddress}
                {...item}
                savedName={savedName(item.platformAddress)}
                onSave={() => save(item.platformAddress)}
              />
            )}
            onRetry={retryPlatformAddresses}
            onClearFilters={clearFilters}
          />
          {!platformLoading && !platformErr && (
            <AddAddressSection walletId={walletId} kind={"platform"} />
          )}
        </div>
      ),
    },
    {
      value: WalletAddressTab.Shielded,
      label: tabs.shielded,
      content: (
        <ShieldedAddressTab
          walletId={walletId}
          toolbar={toolbar}
          query={query}
          usage={usage}
          savedNames={savedNames}
          onSave={save}
          onClearFilters={clearFilters}
        />
      ),
    },
  ]

  return (
    <div className={"px-12 pb-8"}>
      <div className={`relative flex ${SURFACE_PANEL}`}>
        <PageTabs
          items={tabItems}
          value={activeTab}
          onValueChange={changeTab}
        />
      </div>
      <EntryEditModal state={editor} onClose={() => setEditor(null)} />
    </div>
  )
}
