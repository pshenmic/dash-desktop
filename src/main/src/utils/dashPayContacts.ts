import {ContactRequest, DashPayContact} from '../types/Contact'

// Requests come oldest first, so a later one to the same contact replaces an earlier one.
export function dashPayContacts(requests: ContactRequest[], identifiers: string[]): DashPayContact[] {
  const contacts = new Map<string, DashPayContact>()
  const contact = (identifier: string, contactId: string): DashPayContact => {
    const key = `${identifier}:${contactId}`
    if (!contacts.has(key)) contacts.set(key, {identifier, contactId, sent: null, received: null})
    return contacts.get(key)!
  }
  for (const request of requests) {
    if (identifiers.includes(request.ownerId)) contact(request.ownerId, request.toUserId).sent = request
    if (identifiers.includes(request.toUserId)) contact(request.toUserId, request.ownerId).received = request
  }
  return [...contacts.values()]
}
