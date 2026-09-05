import {describe, it, expect, beforeEach, vi} from 'vitest'
import {Script} from 'dash-core-sdk'
import {WalletService} from '../../src/main/src/services/wallet/WalletService'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletProvider} from '../../src/main/src/providers/WalletProvider'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {UTXO} from '../../src/main/src/types/UTXO'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const SCRIPT_HEX = '76a9143a2d4145a4f098523b3e8127f1da87cfc55b8e7988ac'
// Derived by no wallet the harness creates, so nothing can sign for it.
const FOREIGN = 'yPx8DNt1oQt3yubB2Sh73vAQRQ1AoyyLCS'

const utxo = (address: string, satoshis: bigint, txId: string, height: number): UTXO =>
  ({address, satoshis, txId, vOut: 0, script: Script.fromHex(SCRIPT_HEX), height})

const providerStub = (utxos: UTXO[], ready = true): WalletProvider => ({
  getWalletUtxos: async () => utxos,
  getWalletBalance: async () => 0n,
  getBalance: async () => 0n,
  ensureReady: async () => {
    if (!ready) throw new Error('Wallet sync is not complete')
  },
  getConnectionStatus: async () => 'online',
  scanAddressUsage: async () => null,
  getUsedAddresses: async () => [],
  getWalletTransactions: async () => [],
  getAddressInfos: async () => [],
  getTransactionByHash: async () => { throw new Error('unused') },
  getTxLockStatus: async () => ({instantLocked: false, chainlocked: false, confirmed: false}),
  nextUnusedAddress: async () => '',
})

describe('listing the coins a send can draw on', () => {
  let walletService: WalletService
  let providers: WalletProviderFactory
  let createWalletHandler: CreateWalletHandler
  let walletId: string
  let owned: string

  beforeEach(async () => {
    const wired = await harness()
    walletService = wired.walletService
    providers = wired.providers
    createWalletHandler = wired.createWalletHandler
    walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    owned = (await walletService.getAddressesByWalletId(walletId)).receiving[0].address
  })

  it('answers with the coin, its outpoint and the height it confirmed at', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([utxo(owned, 50_000n, 'aa', 2_300_000)]))

    expect(await walletService.getUtxos(walletId)).toEqual([
      {txid: 'aa', vout: 0, satoshis: 50_000n, address: owned, height: 2_300_000},
    ])
  })

  // Offering one would hand the picker a coin whose send refuses at signing.
  it('leaves out outputs the wallet has no derivation path for', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([
      utxo(FOREIGN, 900_000_000n, 'aa', 2_300_000),
      utxo(owned, 50_000n, 'bb', 2_300_001),
    ]))

    const utxos = await walletService.getUtxos(walletId)

    expect(utxos.map(u => u.txid)).toEqual(['bb'])
  })

  it('keeps a mempool output at height zero rather than dropping it', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([utxo(owned, 50_000n, 'aa', 0)]))

    expect((await walletService.getUtxos(walletId))[0].height).toBe(0)
  })

  // Listing a partial set does not under-display, it narrows what can be picked
  // to coins the user cannot tell are only some of theirs.
  it('refuses to list coins a source is not ready to answer for', async () => {
    vi.spyOn(providers, 'forWallet')
      .mockReturnValue(providerStub([utxo(owned, 50_000n, 'aa', 2_300_000)], false))

    await expect(walletService.getUtxos(walletId)).rejects.toThrow('sync is not complete')
  })
})
