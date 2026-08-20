import {describe, it, expect, vi} from 'vitest'
import {P2PWalletProvider} from '../../src/main/src/providers/P2PWalletProvider'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'

const receiving = Array.from({length: 50}, (_, index) => ({address: `addr-${index}`, index}))

function provider(used: string[]): {
  provider: P2PWalletProvider
  getUsedAddresses: ReturnType<typeof vi.fn>
  getTransactionsByAddress: ReturnType<typeof vi.fn>
} {
  const getUsedAddresses = vi.fn(async (_walletId: string, addresses: string[]) =>
    addresses.filter(address => used.includes(address)))
  const getTransactionsByAddress = vi.fn(async () => [])

  const transactionDAO = {getUsedAddresses, getTransactionsByAddress} as unknown as TransactionDAO
  const addressDAO = {getAddressesByWalletId: async () => ({receiving, change: []})} as unknown as AddressDAO

  return {
    provider: new P2PWalletProvider(transactionDAO, 'w1', {} as WalletSyncService, addressDAO),
    getUsedAddresses,
    getTransactionsByAddress,
  }
}

describe('nextUnusedAddress on the local store', () => {
  it('returns the first address with no history', async () => {
    const {provider: p} = provider(['addr-0', 'addr-1', 'addr-2'])

    expect(await p.nextUnusedAddress()).toBe('addr-3')
  })

  // The Receive tab hits this on every visit, across the whole window.
  it('asks the database once, not once per address', async () => {
    const {provider: p, getUsedAddresses, getTransactionsByAddress} = provider(receiving.slice(0, 40).map(a => a.address))

    await p.nextUnusedAddress()

    expect(getUsedAddresses).toHaveBeenCalledTimes(1)
    expect(getTransactionsByAddress).not.toHaveBeenCalled()
  })

  it('falls back to the last address when every one is used', async () => {
    const {provider: p} = provider(receiving.map(a => a.address))

    expect(await p.nextUnusedAddress()).toBe('addr-49')
  })

  it('refuses a wallet with no receiving addresses', async () => {
    const transactionDAO = {getUsedAddresses: vi.fn(async () => [])} as unknown as TransactionDAO
    const addressDAO = {getAddressesByWalletId: async () => ({receiving: [], change: []})} as unknown as AddressDAO
    const p = new P2PWalletProvider(transactionDAO, 'w1', {} as WalletSyncService, addressDAO)

    await expect(p.nextUnusedAddress()).rejects.toThrow('no receiving addresses')
  })
})
