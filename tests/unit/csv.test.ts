import { describe, it, expect } from 'vitest'
import { transactionsToCsv, CsvTxRow } from '../../src/renderer/src/utils/csv'

const ONE_DASH = 100_000_000n

function makeRow(overrides: Partial<CsvTxRow> = {}): CsvTxRow {
  return {
    date: new Date('2026-01-15T10:30:00.000Z'),
    direction: 'in',
    amountDuffs: ONE_DASH,
    address: 'XyTestAddress1111111111111111111111',
    txid: 'a'.repeat(64),
    status: 'success',
    confirmations: 12,
    blockHeight: 2000000,
    ...overrides,
  }
}

describe('transactionsToCsv', () => {
  it('emits a header row even with no transactions', () => {
    const csv = transactionsToCsv([])
    expect(csv).toBe(
      'Date,Direction,Amount (DASH),Address,Transaction ID,Status,Confirmations,Block Height'
    )
  })

  it('renders a received transaction with a positive amount', () => {
    const csv = transactionsToCsv([makeRow()])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe(
      `2026-01-15T10:30:00.000Z,Received,1,XyTestAddress1111111111111111111111,${'a'.repeat(64)},success,12,2000000`
    )
  })

  it('renders a sent transaction with a negative amount', () => {
    const csv = transactionsToCsv([
      makeRow({ direction: 'out', amountDuffs: ONE_DASH / 2n }),
    ])
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('Sent')
    expect(lines[1]).toContain('-0.5')
  })

  it('omits block height when undefined', () => {
    const csv = transactionsToCsv([makeRow({ blockHeight: undefined })])
    const lines = csv.split('\r\n')
    expect(lines[1].endsWith(',12,')).toBe(true)
  })

  it('escapes fields that contain commas or quotes', () => {
    const csv = transactionsToCsv([
      makeRow({ status: 'failed, reverted' }),
    ])
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('"failed, reverted"')
  })

  it('escapes embedded double quotes by doubling them', () => {
    const csv = transactionsToCsv([makeRow({ address: 'has"quote' })])
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('"has""quote"')
  })

  it('renders one line per transaction plus the header', () => {
    const csv = transactionsToCsv([makeRow(), makeRow(), makeRow()])
    expect(csv.split('\r\n')).toHaveLength(4)
  })

  it('neutralizes spreadsheet formula injection in text fields', () => {
    const csv = transactionsToCsv([makeRow({ status: '=HYPERLINK("http://evil")' })])
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain(`'=HYPERLINK`)
  })

  it('neutralizes a leading + @ - in an address field', () => {
    expect(transactionsToCsv([makeRow({ address: '@cmd' })]).split('\r\n')[1]).toContain(`'@cmd`)
    expect(transactionsToCsv([makeRow({ address: '+ping' })]).split('\r\n')[1]).toContain(`'+ping`)
  })

  it('does not prefix a legitimate negative Sent amount', () => {
    const csv = transactionsToCsv([makeRow({ direction: 'out', amountDuffs: ONE_DASH / 2n })])
    const amountCell = csv.split('\r\n')[1].split(',')[2]
    expect(amountCell).toBe('-0.5')
  })
})
