import { useCallback } from 'react'
import { API } from '@renderer/api'
import type { Contact, Network } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { ADDRESS_BOOK_CACHE_NS, ADDRESS_BOOK_COPY, ADDRESS_BOOK_EMPTY } from '@renderer/constants/addressBook'
import type { UseAddressBook } from '@renderer/types/AddressBook'
import { addressBookKey } from '@renderer/utils/addressBook'
import { invalidateAsyncCache, setAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

async function reloadAddressBook(network: Network): Promise<void> {
  setAsyncCache(ADDRESS_BOOK_CACHE_NS, network, await API.getContacts(network))
}

export function useAddressBook(): UseAddressBook {
  const { status } = useAuth()
  const network = status?.network ?? undefined
  const { data, loading, err } = useAsyncWithCache<Contact[]>(
    ADDRESS_BOOK_CACHE_NS,
    network,
    () => API.getContacts(network!),
    ADDRESS_BOOK_EMPTY,
    { errorMessage: ADDRESS_BOOK_COPY.loadFailed },
  )

  const retry = useCallback(() => {
    if (network != null) invalidateAsyncCache(ADDRESS_BOOK_CACHE_NS, network)
  }, [network])

  const addContact = useCallback(async (label: string, address: string) => {
    if (network == null) throw new Error(ADDRESS_BOOK_COPY.noNetwork)
    await API.addContact(label, addressBookKey(address), network)
    await reloadAddressBook(network)
  }, [network])

  const updateContact = useCallback(async (contact: Contact, label: string, address: string) => {
    const key = addressBookKey(address)
    if (key === addressBookKey(contact.address)) {
      await API.deleteContact(contact.id)
      await API.addContact(label, key, contact.network)
    } else {
      await API.addContact(label, key, contact.network)
      await API.deleteContact(contact.id)
    }
    await reloadAddressBook(contact.network)
  }, [])

  const deleteContact = useCallback(async (id: number) => {
    await API.deleteContact(id)
    if (network != null) await reloadAddressBook(network)
  }, [network])

  return { contacts: data, loading, err, network, retry, addContact, updateContact, deleteContact }
}
