import {DashPayContactRequest, DashPayContact} from '../types/DashPay'

// Requests come oldest first, so a later one to the same contact replaces an earlier one.
export function dashPayContacts(requests: DashPayContactRequest[], identifiers: string[]): DashPayContact[] {
  const pairs = new Map<string, {identifier: string; contactId: string; incomingCreatedAt: number | null; outgoingCreatedAt: number | null}>()
  const pair = (identifier: string, contactId: string) => {
    const key = `${identifier}:${contactId}`
    if (!pairs.has(key)) pairs.set(key, {identifier, contactId, incomingCreatedAt: null, outgoingCreatedAt: null})
    return pairs.get(key)!
  }
  for (const request of requests) {
    if (identifiers.includes(request.ownerId)) pair(request.ownerId, request.toUserId).outgoingCreatedAt = request.createdAt
    if (identifiers.includes(request.toUserId)) pair(request.toUserId, request.ownerId).incomingCreatedAt = request.createdAt
  }
  return [...pairs.values()].map(contact => ({
    ...contact,
    relationship: contact.incomingCreatedAt == null ? 'outgoing' : contact.outgoingCreatedAt == null ? 'incoming' : 'established',
    aliasesList: [],
  }))
}
