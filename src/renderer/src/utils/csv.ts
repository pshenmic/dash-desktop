import { davToDash } from './balance'

export interface CsvTxRow {
  date: Date
  direction: 'in' | 'out'
  amountDuffs: bigint
  address: string
  txid: string
  status: string
  confirmations: number
  blockHeight?: number
}

const CSV_HEADER = [
  'Date',
  'Direction',
  'Amount (DASH)',
  'Address',
  'Transaction ID',
  'Status',
  'Confirmations',
  'Block Height',
]

function neutralizeFormula(value: string): string {
  if (value.length > 0 && /^[=+\-@\t\r]/.test(value)) {
    return `'${value}`
  }
  return value
}

function escapeCsvField(value: string): string {
  const safe = neutralizeFormula(value)
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

function toRow(tx: CsvTxRow): string {
  const signedAmount = `${tx.direction === 'out' ? '-' : ''}${davToDash(tx.amountDuffs)}`
  const fields = [
    tx.date.toISOString(),
    tx.direction === 'in' ? 'Received' : 'Sent',
    tx.address,
    tx.txid,
    tx.status,
    String(tx.confirmations),
    tx.blockHeight != null ? String(tx.blockHeight) : '',
  ]
  return [escapeCsvField(fields[0]), fields[1], signedAmount, ...fields.slice(2).map(escapeCsvField)].join(',')
}

export function transactionsToCsv(rows: CsvTxRow[]): string {
  return [CSV_HEADER.join(','), ...rows.map(toRow)].join('\r\n')
}
