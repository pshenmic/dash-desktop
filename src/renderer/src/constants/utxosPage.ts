export interface UtxosPage {
  title: string
  description: string
  columns: {
    date: string
    output: string
    address: string
    label: string
    value: string
  }
  summary: {
    balance: string
    utxoCount: string
    selected: string
    selectedSeparator: string
  }
  buttons: {
    selectAll: string
    clear: string
    sendSelected: string
  }
  unit: string
  pendingBadge: string
  noLabel: string
  labelPlaceholder: string
  labelEditTitle: string
  labelSaveFailed: string
  explorerTitle: string
  errorMessage: string
  emptyMessage: string
  filterDust: string
  dustEmptyMessage: string
}

export const utxosPage: UtxosPage = {
  title: 'UTXOs',
  description: 'This is a list of all **unspent transaction outputs** in your wallet. Each output is a discrete coin you can select and spend. Selecting specific outputs gives you control over which coins are used when sending funds.',
  columns: {
    date: 'Date',
    output: 'Output',
    address: 'Address',
    label: 'Label',
    value: 'Value',
  },
  summary: {
    balance: 'Balance',
    utxoCount: 'UTXO count',
    selected: 'Selected',
    selectedSeparator: ' · ',
  },
  buttons: {
    selectAll: 'Select All',
    clear: 'Clear',
    sendSelected: 'Send Selected',
  },
  unit: 'Dash',
  pendingBadge: 'Pending',
  noLabel: '—',
  labelPlaceholder: 'Add label',
  labelEditTitle: 'Click to edit label',
  labelSaveFailed: 'Failed to save label',
  explorerTitle: 'Open in explorer',
  errorMessage: 'Failed to load UTXOs',
  emptyMessage: 'No UTXOs found',
  filterDust: 'Filter Dust',
  dustEmptyMessage: 'All UTXOs are below the dust threshold',
}

export const UTXO_GRID_TEMPLATE = 'grid grid-cols-[1.75rem_8.5rem_10rem_minmax(16rem,1fr)_6.5rem_8.5rem] items-center gap-2'

export const UTXO_ID_EDGE_CHARS = 6

export const DUST_THRESHOLD_DUFFS = 546n
