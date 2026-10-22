import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Contact } from '@renderer/api/types'
import { AddIcon, Button } from '@renderer/components/dash-ui-kit-enxtended'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import {
  ADDRESS_BOOK_COPY,
  ADDRESS_BOOK_LIST_CLASS,
  ADDRESS_BOOK_PAGE_SIZE,
  ADDRESS_BOOK_PARAMS,
  ADDRESS_BOOK_ROUTES,
  ADDRESS_BOOK_ROW_SKELETON_CLASS,
  ADDRESS_BOOK_SEARCH_SKELETON_ROWS,
  ADDRESS_BOOK_SEGMENT_EMPTY,
  ADDRESS_BOOK_SKELETON_ROWS,
} from '@renderer/constants/addressBook'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { CHIP_ACTION, SURFACE_PANEL } from '@renderer/constants/surfaces'
import { AddressBookSegment, AddressBookSort } from '@renderer/enums/AddressBook'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import { useWalletAddressSet } from '@renderer/hooks/useWalletAddressSet'
import type { AddressBookEditorState, AddressBookEntry } from '@renderer/types/AddressBook'
import { addressBookEntries, countAddressBookSegments, filterAddressBook, sortAddressBook } from '@renderer/utils/addressBook'
import { addressBookNoMatchLabel, addressBookSendHref, addressBookShowAllLabel } from '@renderer/utils/addressBookView'
import { windowList } from '@renderer/utils/listWindow'
import { enumParam, withParams } from '@renderer/utils/searchParams'
import AddressBookRow from './AddressBookRow'
import AddressBookToolbar from './AddressBookToolbar'
import EntryDetailModal from './EntryDetailModal'
import EntryEditModal from './EntryEditModal'
import RemoveEntryModal from './RemoveEntryModal'

export default function AddressBookPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { contacts, loading, err, network, retry } = useAddressBook()
  const owned = useWalletAddressSet()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(AddressBookSort.Name)
  const [visibleCount, setVisibleCount] = useState(ADDRESS_BOOK_PAGE_SIZE)
  const [detail, setDetail] = useState<AddressBookEntry | null>(null)
  const [editor, setEditor] = useState<AddressBookEditorState | null>(null)
  const [removing, setRemoving] = useState<Contact | null>(null)
  const deferredQuery = useDeferredValue(query)
  const searching = deferredQuery !== query
  const segment = enumParam(AddressBookSegment, searchParams.get(ADDRESS_BOOK_PARAMS.segment), AddressBookSegment.All)

  const entries = useMemo(() => addressBookEntries(contacts, network ?? null, owned), [contacts, network, owned])
  const counts = useMemo(() => countAddressBookSegments(entries, deferredQuery), [entries, deferredQuery])
  const visible = useMemo(
    () => sortAddressBook(filterAddressBook(entries, deferredQuery, segment), sort),
    [entries, deferredQuery, segment, sort],
  )
  const view = useMemo(() => windowList(visible, visibleCount), [visible, visibleCount])
  const showMore = view.hasMore && !searching
  const showNext = (): void => setVisibleCount(count => count + ADDRESS_BOOK_PAGE_SIZE)
  const sentinelRef = useScrollEndSentinel(showMore, showNext, visibleCount)

  const changeSegment = (next: AddressBookSegment): void => {
    setSearchParams(
      prev => withParams(prev, { [ADDRESS_BOOK_PARAMS.segment]: next === AddressBookSegment.All ? null : next }),
      { replace: true },
    )
    setVisibleCount(ADDRESS_BOOK_PAGE_SIZE)
  }
  const changeQuery = (next: string): void => {
    setQuery(next)
    setVisibleCount(ADDRESS_BOOK_PAGE_SIZE)
  }
  const changeSort = (next: AddressBookSort): void => {
    setSort(next)
    setVisibleCount(ADDRESS_BOOK_PAGE_SIZE)
  }
  const send = (entry: AddressBookEntry): void => {
    if (entry.kind != null) navigate(addressBookSendHref(entry.kind, entry.contact.address))
  }
  const edit = (contact: Contact): void => {
    setDetail(null)
    setEditor({ contact, address: contact.address })
  }
  const remove = (contact: Contact): void => {
    setDetail(null)
    setRemoving(contact)
  }
  const addButton = (
    <Button type={'button'} size={'compact'} colorScheme={'primary'} className={'gap-2'} onClick={() => setEditor({ contact: null, address: '' })}>
      <AddIcon size={12} color={'currentColor'} />
      {ADDRESS_BOOK_COPY.add}
    </Button>
  )

  const segmentCount = counts[segment]
  let list: React.JSX.Element
  if (searching) {
    list = <ListSkeleton rows={ADDRESS_BOOK_SEARCH_SKELETON_ROWS} rowClassName={ADDRESS_BOOK_ROW_SKELETON_CLASS} />
  } else if (segmentCount === 0 && deferredQuery.trim() !== '') {
    list = (
      <NoResults
        noResults={addressBookNoMatchLabel(deferredQuery.trim())}
        action={
          <div className={'flex items-center gap-2'}>
            <button type={'button'} onClick={() => changeQuery('')} className={CHIP_ACTION}>{ADDRESS_BOOK_COPY.clearSearch}</button>
            {segment !== AddressBookSegment.All && counts[AddressBookSegment.All] > 0 && (
              <button type={'button'} onClick={() => changeSegment(AddressBookSegment.All)} className={CHIP_ACTION}>
                {addressBookShowAllLabel(counts[AddressBookSegment.All])}
              </button>
            )}
          </div>
        }
      />
    )
  } else if (segmentCount === 0) {
    list = <NoResults noResults={ADDRESS_BOOK_SEGMENT_EMPTY[segment]} />
  } else {
    list = (
      <div className={ADDRESS_BOOK_LIST_CLASS}>
        <ul className={'contents'}>
          {view.items.map(entry => (
            <AddressBookRow key={entry.contact.id} entry={entry} onOpen={setDetail} onSend={send} onEdit={edit} onRemove={remove} />
          ))}
        </ul>
        {showMore && <ShowMoreButton ref={sentinelRef} remaining={view.remaining} onClick={showNext} />}
      </div>
    )
  }

  let body: React.JSX.Element
  if (loading && contacts.length === 0) {
    body = <ListSkeleton rows={ADDRESS_BOOK_SKELETON_ROWS} rowClassName={ADDRESS_BOOK_ROW_SKELETON_CLASS} />
  } else if (err != null && contacts.length === 0) {
    body = <NoResults tone={NoResultsTone.Error} noResults={ADDRESS_BOOK_COPY.loadFailed} action={<RetryButton onRetry={retry} />} />
  } else if (contacts.length === 0) {
    body = <NoResults title={ADDRESS_BOOK_SEGMENT_EMPTY[AddressBookSegment.All]} description={ADDRESS_BOOK_COPY.emptyDescription} action={addButton} />
  } else {
    body = (
      <div className={'flex flex-col gap-4'}>
        <AddressBookToolbar
          query={query}
          onQueryChange={changeQuery}
          sort={sort}
          onSortChange={changeSort}
          segment={segment}
          onSegmentChange={changeSegment}
          counts={counts}
        />
        <div aria-busy={searching}>{list}</div>
      </div>
    )
  }

  return (
    <div className={'flex flex-col px-12 pb-12'}>
      <PageHeader
        title={PAGE_HEADERS.addressBook.title}
        subtitle={PAGE_HEADERS.addressBook.subtitle}
        actions={
          <>
            <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={() => navigate(ADDRESS_BOOK_ROUTES.wallet)}>
              {ADDRESS_BOOK_COPY.walletAddresses}
            </Button>
            {addButton}
          </>
        }
      />
      <div className={SURFACE_PANEL}>{body}</div>
      <EntryDetailModal entry={detail} network={network} onClose={() => setDetail(null)} onSend={send} onEdit={edit} onRemove={remove} />
      <EntryEditModal state={editor} owned={owned} onClose={() => setEditor(null)} />
      <RemoveEntryModal contact={removing} onClose={() => setRemoving(null)} />
    </div>
  )
}
