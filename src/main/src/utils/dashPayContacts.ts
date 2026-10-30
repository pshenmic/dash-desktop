import {DashPayContactRequest, DashPayContact, DashPayContactRelationship, DashPayPayment} from '../types/DashPay'
import {Transaction} from '../types/Transaction'
import {DUFFS_PER_DASH} from '../constants/chain'

// Requests come oldest first, so a later one to the same contact replaces an earlier one.
export function dashPayContacts(
  requests: DashPayContactRequest[],
  identifiers: string[],
  contactKeys: Map<string, string | null>,
): Array<Omit<DashPayContact, 'usernames'>> {
  const pairs = new Map<string, Omit<DashPayContact, 'relationship' | 'usernames'>>()
  const pair = (identifier: string, contactId: string): Omit<DashPayContact, 'relationship' | 'usernames'> => {
    const key = `${identifier}:${contactId}`
    if (!pairs.has(key)) pairs.set(key, {identifier, contactId, incomingCreatedAt: null, outgoingCreatedAt: null, paymentChannelBroken: false})
    return pairs.get(key)!
  }
  for (const request of requests) {
    if (identifiers.includes(request.ownerId)) pair(request.ownerId, request.toUserId).outgoingCreatedAt = request.createdAt
    if (identifiers.includes(request.toUserId)) {
      Object.assign(pair(request.toUserId, request.ownerId), {incomingCreatedAt: request.createdAt, paymentChannelBroken: contactKeys.get(request.id) === null})
    }
  }
  return [...pairs.values()].map(contact => ({...contact, relationship: relationship(contact)}))
}

function relationship({incomingCreatedAt, outgoingCreatedAt}: Pick<DashPayContact, 'incomingCreatedAt' | 'outgoingCreatedAt'>): DashPayContactRelationship {
  if (incomingCreatedAt != null && outgoingCreatedAt != null) return 'established'
  return incomingCreatedAt != null ? 'incoming' : 'outgoing'
}

// Our transactions with outputs on one friendship's chains: ours for what they
// paid us, theirs for what we paid them. Newest first.
export function dashPayPayments(transactions: Transaction[], receiving: Set<string>, external: Set<string>): DashPayPayment[] {
  return transactions.flatMap(tx => ([['received', receiving], ['sent', external]] as const).flatMap(([direction, chain]) => {
    const amountDuffs = tx.vout.filter(output => chain.has(output.address)).reduce((sum, output) => sum + duffsOf(output.value), 0n)
    return amountDuffs > 0n ? [{txid: tx.txid, amountDuffs, direction, date: tx.date.getTime()}] : []
  })).sort((a, b) => b.date - a.date)
}

// Both providers give output values as DASH with exactly eight decimals.
function duffsOf(dash: string): bigint {
  const [whole, fraction = ''] = dash.split('.')
  return BigInt(whole) * DUFFS_PER_DASH + BigInt(fraction.padEnd(8, '0'))
}
