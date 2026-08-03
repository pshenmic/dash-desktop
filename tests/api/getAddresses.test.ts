import {describe, it, expect, beforeEach} from 'vitest'
import {GetWalletAddressesHandler} from '../../src/main/src/api/wallet/getAddresses'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

describe('GetWalletAddressesHandler', () => {
  let handler: GetWalletAddressesHandler
  let createWalletHandler: CreateWalletHandler

  beforeEach(async () => {
    const wired = await harness()
    createWalletHandler = wired.createWalletHandler
    handler = new GetWalletAddressesHandler(wired.walletService)
  })

  it('returns 20 receiving and 20 change addresses for a fresh wallet', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const grouped = await handler.handle(null as never, walletId)

    expect(grouped.receiving).toHaveLength(20)
    expect(grouped.change).toHaveLength(20)
  })

  it('returns addresses scoped to the requested wallet', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const grouped = await handler.handle(null as never, walletId)

    for (const a of [...grouped.receiving, ...grouped.change]) {
      expect(a.walletId).toBe(walletId)
    }
  })

  it('annotates a zero balance for an unsynced wallet in p2p mode', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const grouped = await handler.handle(null as never, walletId)

    for (const a of [...grouped.receiving, ...grouped.change]) {
      expect(a.balance).toBe(0n)
    }
  })

  it('throws for an unknown walletId', async () => {
    await expect(
      handler.handle(null as never, 'nonexistent'),
    ).rejects.toThrow('Wallet not found')
  })
})
