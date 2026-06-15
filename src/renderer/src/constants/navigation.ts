export interface NavItem {
  id: string
  label: string
  to: string
}

export interface NavGroup {
  id: string
  label?: string
  items: NavItem[]
}

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
      },
      {
        id: 'addresses',
        label: 'Addresses',
        to: '/addresses'
      },
      {
        id: 'identities',
        label: 'Identities',
        to: '/identities'
      },
      {
        id: 'settings',
        label: 'Settings',
        to: '/settings'
      }
    ]
  },
]
