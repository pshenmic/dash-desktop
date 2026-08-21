import { useCallback, useEffect, useState } from 'react'
import { API } from '@renderer/api'
import { Contact, Network } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'

export interface UseAddressBook {
  contacts: Contact[]
  loading: boolean
  network: Network | undefined
  reload: () => void
  addContact: (label: string, address: string) => Promise<void>
  deleteContact: (id: number) => Promise<void>
}

export function useAddressBook(): UseAddressBook {
  const { status } = useAuth()
  const network = (status?.network ?? undefined) as Network | undefined
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    if (!network) {
      setContacts([])
      setLoading(false)
      return
    }
    setLoading(true)
    API.getContacts(network)
      .then((list) => setContacts(list ?? []))
      .catch((e) => console.error('getContacts failed', e))
      .finally(() => setLoading(false))
  }, [network])

  useEffect(() => {
    reload()
  }, [reload])

  const addContact = useCallback(
    async (label: string, address: string) => {
      if (!network) {
        throw new Error('No active network')
      }
      await API.addContact(label, address, network)
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

  return { contacts, loading, network, reload, addContact, deleteContact }
}
