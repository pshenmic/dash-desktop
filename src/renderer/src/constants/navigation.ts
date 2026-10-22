export interface NavItem {
  id: string
  label: string
  to: string
  debugOnly?: boolean
}

export interface NavGroup {
  id: string
  label?: string
  items: NavItem[]
}

export const IDENTITIES_ROUTE = '/identities'

export const navGroups: NavGroup[] = [
  {
    id: 'main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        to: '/'
      },
      {
        id: 'transactions',
        label: 'Transactions',
        to: '/transactions'
      },
      {
        id: 'send',
        label: 'Send',
        to: '/send'
      },
      {
        id: 'receive',
        label: 'Receive',
        to: '/receive'
      }
    ]
  },
  {
    id: 'wallet',
    items: [
      {
        id: 'addresses',
        label: 'Address book',
        to: '/address-book'
      },
      {
        id: 'identities',
        label: 'Identities',
        to: IDENTITIES_ROUTE
      },
      {
        id: 'dashpay',
        label: 'DashPay',
        to: '/dashpay'
      },
      {
        id: 'masternodes',
        label: 'Masternodes',
        to: '/masternodes',
        debugOnly: true
      },
      {
        id: 'shielded',
        label: 'Shielded',
        to: '/shielded',
        debugOnly: true
      },
      {
        id: 'settings',
        label: 'Settings',
        to: '/settings'
      }
    ]
  },
]
