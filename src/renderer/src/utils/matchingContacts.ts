import type { Contact } from '../api/types'

export function matchingContacts(contacts: Contact[], query: string, isValid: (address: string) => boolean): Contact[] {
  const needle = query.trim().toLowerCase()
  return contacts.filter(contact =>
    isValid(contact.address)
    && (contact.address.toLowerCase().includes(needle) || contact.label.toLowerCase().includes(needle)))
}
