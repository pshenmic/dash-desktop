import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, Heading, Input, SearchIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { Tabs } from 'dash-ui-kit/react'
import AddressList from '@renderer/components/pages/addresses/AddressList'
import ContactEditModal from '@renderer/components/modal/ContactEditModal'
import AddressQrModal from '@renderer/components/modal/AddressQrModal'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DropdownField from '@renderer/components/ui/DropdownField'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { toast } from '@renderer/components/ui/Toast'
import { ADDRESS_BOOK_TYPES } from '@renderer/constants/addressBook'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import { useOwnAddresses } from '@renderer/hooks/useOwnAddresses'
import { useErrorToast } from '@renderer/hooks/useErrorToast'
import { addressKey, getContactKind } from '@renderer/utils/addressBook'
import { getErrorMessage } from '@renderer/utils/error'
import { addressUrl, identityUrl, openExternal, platformAddressUrl } from '@renderer/utils/explorer'
import type { Contact } from '@renderer/api/types'

function AddressBookContent(): React.JSX.Element {
  const { status } = useAuth()
  const { syncIncomplete } = useConnectionModeContext()
  const location = useLocation()
  const navigate = useNavigate()
  const book = useAddressBook()
  useErrorToast(book.error)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [ownership, setOwnership] = useState('all')
  const [editing, setEditing] = useState<{ contact?: Contact; address?: string } | null>(null)
  const owned = useOwnAddresses(editing)
  const [details, setDetails] = useState<Contact | null>(null)
  const [removing, setRemoving] = useState(false)
  const [qr, setQr] = useState<Contact | null>(null)
  const walletView = location.pathname !== '/address-book'
  const query = search.trim().toLowerCase()
  const contacts = book.contacts.filter(contact => (kind === 'all' || contact.kind === kind)
    && (ownership !== 'wallet' || owned.has(addressKey(contact.address)))
    && (!query || contact.label.toLowerCase().includes(query) || contact.address.toLowerCase().includes(query)))
  const valid = (contact: Contact): boolean => getContactKind(contact.address, book.network) === contact.kind
  const send = (contact: Contact): void => {
    const params = new URLSearchParams({ recipient: contact.address, network: book.network!, wallet: status!.selectedWalletId! })
    navigate(`/send?${params}`)
  }
  const remove = async (): Promise<void> => {
    if (!details || removing) return
    setRemoving(true)
    try { await book.deleteContact(details.id); setDetails(null) }
    catch (error) { toast.error(`**Could not remove address** ${getErrorMessage(error)}`) }
    finally { setRemoving(false) }
  }

  return <div className="flex flex-col gap-6 pb-8">
    <div className="px-12 flex items-start justify-between gap-5 flex-wrap">
      <div>
        {walletView && <Link to="/address-book" className="dash-text-primary text-sm block mb-3">← Address book</Link>}
        <Heading as="h1" size="xl40" weight="medium" color="brand-white" className="tracking-[-0.03em]">{walletView ? 'Wallet addresses' : 'Address book'}</Heading>
        <Text size={14} color="brand" opacity={50} className="mt-3">{walletView ? 'View your addresses and save the ones you use.' : 'Saved addresses and identities, all in one place.'}</Text>
      </div>
      <div className="flex gap-3 shrink-0">
        {!walletView && <Button variant="outline" colorScheme="brand-mint" size="sm" className="h-8! min-h-0! rounded-[.625rem]! px-3!" onClick={() => navigate('/address-book/wallet?tab=receiving&usage=used')}>Wallet addresses</Button>}
        {!walletView && <Button colorScheme="primary" size="sm" className="h-8! min-h-0! rounded-[.625rem]! px-3!" onClick={() => setEditing({})}>+ Add address</Button>}
      </div>
    </div>
    {walletView ? <AddressList coreGated={syncIncomplete} contacts={book.contacts} onSaveAddress={address => setEditing({ address })} /> : <div className="mx-12 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]">
      <Tabs value={kind} onValueChange={setKind} size="xl" triggerClassName={
        'data-[state=active]:text-dash-primary-dark-blue ' +
        'data-[state=inactive]:text-dash-primary-dark-blue/35 ' +
        'dark:data-[state=active]:text-white ' +
        'dark:data-[state=inactive]:text-white/35 ' +
        'font-medium tracking-[-0.03em]'
      } items={[{ kind: 'all', label: 'All' }, ...ADDRESS_BOOK_TYPES].map(item => ({ value: item.kind, label: item.label, content: <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex-1"><Input type="search" size="sm" colorScheme="light" variant="filled" aria-label="Search address book" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, address or identity ID" prefix={<SearchIcon size={14} color="currentColor" className="dash-text-default" />} /></div>
        <DropdownField options={[{ value: 'all', label: 'All entries' }, { value: 'wallet', label: 'This wallet' }]} value={ownership} onChange={setOwnership} ariaLabel="Address ownership" triggerClassName="dash-block dash-black-border rounded-[.625rem] px-3 py-2" />
      </div>
      {book.error && <button type="button" onClick={book.reload} className="self-start text-sm dash-text-primary underline cursor-pointer">Retry loading address book</button>}
      {book.loading ? <ListSkeleton rows={4} /> : contacts.map(contact => <div key={contact.id} className="flex items-center gap-5 p-4 rounded-2xl dash-block">
        <button type="button" onClick={() => setDetails(contact)} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2"><Text size={14} weight="medium" color="brand" className="truncate">{contact.label}</Text>{owned.has(addressKey(contact.address)) && <CustomBadge text="This wallet" />}</div>
          <Text size={12} color="brand" opacity={50} className="font-mono truncate mt-1">{contact.address}</Text>
        </button>
        <CustomBadge variant="muted" text={valid(contact) ? ADDRESS_BOOK_TYPES.find(item => item.kind === contact.kind)!.label : 'Needs review'} />
        <CopyButton text={contact.address} />
        <button type="button" disabled={!valid(contact)} onClick={() => send(contact)} className="dash-text-primary text-sm cursor-pointer disabled:opacity-30">Send</button>
        <button type="button" aria-label={`Details for ${contact.label}`} onClick={() => setDetails(contact)} className="dash-text-default cursor-pointer px-2">•••</button>
      </div>)}
      {!book.loading && contacts.length === 0 && <Text size={14} color="brand" opacity={50} className="text-center py-12">{book.contacts.length ? 'No addresses match your filters.' : 'No saved addresses yet. Add an address or choose one from Wallet addresses.'}</Text>}
      </div> }))} />
    </div>}
    {editing && <ContactEditModal {...editing} owned={owned} onClose={() => setEditing(null)} onSave={(label, address, type) => editing.contact ? book.updateContact(editing.contact.id, label, address, type) : book.addContact(label, address, type)} />}
    {details && createPortal(<div className="fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in">
      <div role="dialog" aria-modal="true" aria-label="Address details" onKeyDown={event => { if (event.key === 'Escape' && !removing) setDetails(null) }} className="w-full max-w-lg rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in flex flex-col gap-5">
        <div className="flex justify-between gap-3"><Heading as="h2" size="xl" color="brand-white" className="break-all">{details.label}</Heading><button autoFocus type="button" aria-label="Close details" disabled={removing} onClick={() => setDetails(null)} className="dash-text-default cursor-pointer">✕</button></div>
        <Text size={14} color="brand" className="break-all font-mono">{details.address}</Text>
        {owned.has(addressKey(details.address)) && <CustomBadge text="This wallet" className="self-start" />}
        <div className="flex gap-3 items-center"><CopyButton text={details.address} /><button type="button" onClick={() => { setQr(details); setDetails(null) }} className="dash-text-primary text-sm cursor-pointer">Show QR</button>
          {details.kind !== 'shielded' && valid(details) && <button type="button" onClick={() => openExternal((details.kind === 'core' ? addressUrl : details.kind === 'platform' ? platformAddressUrl : identityUrl)(details.address, details.network))} className="dash-text-primary text-sm cursor-pointer">Explorer ↗</button>}
        </div>
        <div className="flex justify-between gap-3">
          <Button variant="outline" colorScheme="brand-mint" size="sm" disabled={removing} onClick={remove}>{removing ? 'Removing…' : 'Remove from book'}</Button>
          <Button colorScheme="primary" size="sm" disabled={removing} onClick={() => { setEditing({ contact: details }); setDetails(null) }}>Edit</Button>
        </div>
        <Text size={12} color="brand" opacity={50}>Removing this entry only removes it from your address book.</Text>
      </div>
    </div>, document.body)}
    {qr && <AddressQrModal address={qr.address} raw={qr.kind !== 'core'} title={qr.label} onClose={() => setQr(null)} />}
  </div>
}

export default function AddressesPage(): React.JSX.Element {
  const { status } = useAuth()
  return <AddressBookContent key={`${status?.network}:${status?.selectedWalletId}`} />
}
