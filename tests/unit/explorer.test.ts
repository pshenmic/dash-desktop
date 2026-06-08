import { describe, it, expect } from 'vitest'
import { transactionUrl } from '../../src/renderer/src/utils/explorer'

const TXID = '0093d045fb4cc527896b50890d84b572c78dfddc1f75857247065929bb0fce4f'

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
