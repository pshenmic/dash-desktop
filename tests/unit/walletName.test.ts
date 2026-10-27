import { describe, it, expect } from 'vitest'
import { walletDisplayNameById } from '../../src/renderer/src/utils/walletName'
import type { WalletDto } from '../../src/renderer/src/api/types'

const wallet = (walletId: string, label: string | null = null): WalletDto =>
  ({ walletId, network: 'testnet', selected: false, label })

describe('walletDisplayNameById', () => {
  const wallets = [wallet('a', 'Savings'), wallet('b'), wallet('c', '  ')]

  it('returns the label of the matching wallet', () => {
    expect(walletDisplayNameById(wallets, 'a')).toBe('Savings')
  })

  it('falls back to the positional name for an unlabeled wallet', () => {
    expect(walletDisplayNameById(wallets, 'b')).toBe('Wallet_2')
    expect(walletDisplayNameById(wallets, 'c')).toBe('Wallet_3')
  })

  it('returns null for an unknown or missing id', () => {
    expect(walletDisplayNameById(wallets, 'z')).toBeNull()
    expect(walletDisplayNameById(wallets, null)).toBeNull()
  })
})
