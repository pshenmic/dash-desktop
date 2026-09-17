import { useCallback, useEffect, useRef, useState } from 'react'
import { API } from '@renderer/api'
import { Contact, ContactKind, Network } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { getErrorMessage } from '@renderer/utils/error'
import { addressKey } from '@renderer/utils/addressBook'

export interface UseAddressBook {
  contacts: Contact[]
  loading: boolean
  error: string | null
  network: Network | undefined
  reload: () => void
  addContact: (label: string, address: string, kind?: ContactKind) => Promise<void>
  updateContact: (id: number, label: string, address: string, kind: ContactKind) => Promise<void>
  deleteContact: (id: number) => Promise<void>
}

export function useAddressBook(): UseAddressBook {
  const { status } = useAuth()
  const network = (status?.network ?? undefined) as Network | undefined
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loadedNetwork, setLoadedNetwork] = useState<Network>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)

  const reload = useCallback(() => {
    const current = ++request.current
    setError(null)
    if (!network) {
      setContacts([])
      setLoading(false)
      return
    }
    setLoading(true)
    API.getContacts(network)
      .then((list) => { if (current === request.current) { setContacts(list ?? []); setLoadedNetwork(network) } })
      .catch((e) => { if (current === request.current) setError(getErrorMessage(e)) })
      .finally(() => { if (current === request.current) setLoading(false) })
  }, [network])

  useEffect(() => {
    setContacts([])
    reload()
    return () => { request.current++ }
  }, [reload])

  const addContact = useCallback(
    async (label: string, address: string, kind: ContactKind = 'core') => {
      if (!network) {
        throw new Error('No active network')
      }
      await API.addContact(label, addressKey(address), network, kind)
      reload()
    },
    [network, reload],
  )

  const deleteContact = useCallback(
    async (id: number) => {
      await API.deleteContact(id)
      reload()
    },
    [reload],
  )

  const updateContact = useCallback(async (id: number, label: string, address: string, kind: ContactKind) => {
    await API.updateContact(id, label, addressKey(address), kind)
    reload()
  }, [reload])

  return { contacts: loadedNetwork === network ? contacts : [], loading, error, network, reload, addContact, updateContact, deleteContact }
}
