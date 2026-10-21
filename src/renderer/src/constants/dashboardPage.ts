export const RECENT_TX_LIMIT = 3

export const dashboardPage = {
  hero: {
    totalBalance: 'Total balance',
    price: 'Price:',
    core: {
      title: 'Core',
      balance: 'Balance:'
    },
    platform: {
      title: 'Platform',
      balance: 'Balance:'
    }
  },
  sections: {
    services: 'Shielded & Identities',
    stats: 'Statistics'
  },
  shielded: {
    title: 'Shielded',
    open: 'Open',
    balance: 'Shielded balance',
    poolTotal: 'Pool total',
    spendableNotes: 'spendable notes',
    proverUnavailable: 'Private sending unavailable',
    sync: 'Sync',
    syncNotes: 'Sync notes',
    syncing: 'Syncing…'
  },
  identities: {
    title: 'Identities',
    viewAll: 'View all',
    totalBalance: 'Total balance',
    one: 'identity',
    many: 'identities',
    top: 'top',
    credits: 'credits',
    empty: 'No identities yet'
  },
  network: {
    title: 'Network',
    chainTip: 'Chain tip',
    peers: 'Peers',
    dataSource: 'Data source'
  },
  stats: {
    transactions: 'Transactions',
    totalReceived: 'Total received',
    totalSent: 'Total sent',
    largestReceived: 'Largest received',
    walletAge: 'Wallet age',
    lastActivity: 'Last activity',
    pending: 'Pending',
    addressesUsed: 'Addresses used',
    evoHistoryIncomplete: 'Evo history incomplete'
  },
  analytics: {
    excluded: 'excluded',
    undatedHint: 'No date available'
  },
  recent: {
    title: 'Recent activity',
    viewAll: 'View all',
    error: 'Failed to load wallet activity',
    empty: 'No transactions found'
  },
  empty: {
    title: 'No activity yet',
    subtitle: 'Receive your first Dash to see wallet stats here',
    action: 'Receive Dash'
  }
}
