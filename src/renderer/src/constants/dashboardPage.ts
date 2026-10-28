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
    evoHistoryIncomplete: 'Evo history incomplete',
    activity: 'Activity',
    since: 'since',
    noDatedActivity: 'No dated activity',
    coreAddressesTitle: 'Receiving and change addresses',
    evoAddressesTitle: 'Platform addresses with a balance or prior spending activity',
    loading: 'Loading…',
    unavailable: 'Unavailable',
    cumulative: 'cumulative',
    daily: 'daily'
  },
  analytics: {
    title: 'Wallet analytics & statistics',
    periodAria: 'Analytics period',
    localTime: 'local time',
    amountsHidden: 'Amounts hidden',
    excluded: 'excluded',
    undatedHint: 'No date available',
    coreBalance: {
      title: 'Core balance',
      description: 'Daily closing balance, incl. pending.',
      current: 'Current balance: ',
      closing: 'Closing balance: ',
      loading: 'Loading balance…',
      unavailable: 'Balance unavailable',
      incomplete: 'Balance history is incomplete'
    },
    balances: {
      title: 'Current balances',
      description: 'Not affected by the selected period.',
      total: 'total',
      loading: 'Loading balances…',
      unavailable: 'Balances unavailable'
    },
    evoTypes: {
      title: 'Evo transaction types',
      description: 'Transaction count and share by type · all statuses',
      region: 'Evo transaction counts by type',
      empty: 'No Evo transactions in this period'
    }
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
