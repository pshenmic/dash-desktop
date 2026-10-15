import type { DashpayContactStatus } from '@renderer/types/dashpayDemo'
import type { DashpayContactPresentation, DashpayContactTab } from '@renderer/types/dashpayContacts'

export const DASHPAY_CONTACT_TABS: DashpayContactTab[] = [
  {
    status: 'contact',
    label: 'Established',
    title: 'Your people',
    description: 'People connected to this DashPay identity.',
    emptyTitle: 'Your next connection starts here',
    emptyDescription: 'Find someone by their DashPay name and send a contact request. Accepted requests appear here.',
  },
  {
    status: 'incoming',
    label: 'Incoming',
    title: 'People reaching out',
    description: 'Accept a request to add someone to your DashPay contacts.',
    emptyTitle: 'All caught up',
    emptyDescription: 'New contact requests for this identity will appear here. You can also find someone and reach out first.',
  },
  {
    status: 'outgoing',
    label: 'Sent',
    title: 'Requests you sent',
    description: 'These people have not accepted your contact request yet.',
    emptyTitle: 'No requests waiting',
    emptyDescription: 'Find a DashPay name to send a new request. It stays pending until the other person accepts.',
  },
]

export const DASHPAY_CONTACT_PRESENTATION: Record<DashpayContactStatus, DashpayContactPresentation> = {
  contact: {
    label: 'Connected',
    description: 'You are connected through this demo identity.',
    tone: 'mint',
  },
  incoming: {
    label: 'Incoming request',
    description: 'This person would like to connect with you. Accept to add them to your contacts, or ignore the request.',
    tone: 'amber',
  },
  outgoing: {
    label: 'Request sent',
    description: 'Your request is waiting for this person to accept. Sending a request does not establish a contact yet.',
    tone: 'blue',
  },
}
