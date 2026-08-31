import {describe, it, expect, beforeEach} from 'vitest'
import {GetWalletAddressesHandler} from '../../src/main/src/api/wallet/getAddresses'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {CORE_ADDRESS_WINDOW} from '../../src/main/src/constants/addresses'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

describe('GetWalletAddressesHandler', () => {
  let handler: GetWalletAddressesHandler
  let createWalletHandler: CreateWalletHandler

  beforeEach(async () => {
    const wired = await harness()
    createWalletHandler = wired.createWalletHandler
    handler = new GetWalletAddressesHandler(wired.walletService)
  })

  it('returns the initial lookahead window for a fresh wallet', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const grouped = await handler.handle(null as never, walletId)

    expect(grouped.receiving).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
    expect(grouped.change).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
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
