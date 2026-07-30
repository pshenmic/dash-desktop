import { describe, it, expect } from 'vitest'
import { transactionUrl, addressUrl, platformTransactionUrl } from '../../src/renderer/src/utils/explorer'

const TXID = '0093d045fb4cc527896b50890d84b572c78dfddc1f75857247065929bb0fce4f'
const ADDRESS = 'XdAUmwtig27HBG6WfYyHAzP8n6XC9jESEw'
const ST_HASH = '3B5A2C0335F87C87B9C0C25C6224D2A0022D6D0EE1D2D4B72F02E57D1F9FED5F'

describe('transactionUrl', () => {
  it('builds a testnet dashscan url', () => {
    expect(transactionUrl(TXID, 'testnet')).toBe(
      `https://testnet.dashscan.io/transactions/${TXID}`,
    )
  })

  it('builds a mainnet dashscan url', () => {
    expect(transactionUrl(TXID, 'mainnet')).toBe(
      `https://dashscan.io/transactions/${TXID}`,
    )
  })
})

describe('addressUrl', () => {
  it('builds a testnet dashscan url', () => {
    expect(addressUrl(ADDRESS, 'testnet')).toBe(
      `https://testnet.dashscan.io/address/${ADDRESS}`,
    )
  })

  it('builds a mainnet dashscan url', () => {
    expect(addressUrl(ADDRESS, 'mainnet')).toBe(
      `https://dashscan.io/address/${ADDRESS}`,
    )
  })
})

describe('platformTransactionUrl', () => {
  it('builds a testnet platform explorer url', () => {
    expect(platformTransactionUrl(ST_HASH, 'testnet')).toBe(
      `https://testnet.platform-explorer.com/transaction/${ST_HASH}`,
    )
  })

  it('builds a mainnet platform explorer url', () => {
    expect(platformTransactionUrl(ST_HASH, 'mainnet')).toBe(
      `https://platform-explorer.com/transaction/${ST_HASH}`,
    )
  })
})
