import {describe, it, expect, beforeEach, vi} from 'vitest'
import {Script} from 'dash-core-sdk'
import {WalletService} from '../../src/main/src/services/WalletService'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletProvider} from '../../src/main/src/providers/WalletProvider'
import {UTXO} from '../../src/main/src/types/UTXO'
import {TransferInput} from '../../src/main/src/types/CoreTransaction'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const SCRIPT_HEX = '76a9143a2d4145a4f098523b3e8127f1da87cfc55b8e7988ac'
// Asserted foreign in beforeEach: one of the seed's own indexes here would
// quietly turn these into no-op tests.
const FOREIGN = 'yPx8DNt1oQt3yubB2Sh73vAQRQ1AoyyLCS'

const utxo = (address: string, satoshis: bigint, txId: string): UTXO =>
  ({address, satoshis, txId, vOut: 0, script: Script.fromHex(SCRIPT_HEX)})

const providerStub = (utxos: UTXO[]): WalletProvider => ({
  getWalletUtxos: async () => utxos,
  ensureReady: async () => undefined,
  scanAddressUsage: async () => null,
  getUsedAddresses: async () => [],
  getWalletTransactions: async () => [],
  getAddressInfos: async () => [],
  getWalletBalance: async () => 0n,
  getBalance: async () => 0n,
  getTransactionByHash: async () => { throw new Error('unused') },
  getTxLockStatus: async () => ({instantLocked: false, chainlocked: false, confirmed: false}),
  nextUnusedAddress: async () => '',
})

describe('gathering transfer inputs from a wallet-wide utxo set', () => {
  let walletService: WalletService
  let addressDAO: AddressDAO
  let createWalletHandler: CreateWalletHandler
  let walletId: string
  let mine: string[]

  beforeEach(async () => {
    const wired = await harness()
    walletService = wired.walletService
    addressDAO = wired.addressDAO
    createWalletHandler = wired.createWalletHandler
    walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving, change} = await addressDAO.getAddressesByWalletId(walletId)
    mine = receiving.map(a => a.address)
    expect([...receiving, ...change].map(a => a.address)).not.toContain(FOREIGN)
  })

  const gather = async (utxos: UTXO[], amount: bigint, fromAddress?: string): Promise<TransferInput[]> => {
    vi.spyOn(walletService, 'getProvider').mockReturnValue(providerStub(utxos))
    const {transferInputs} = await walletService['gatherTransferInputs'](
      walletId, 'testnet', amount, fromAddress,
    )
    return transferInputs
  }

  // Selecting one would fail at signing time, after the spend was built.
  it('ignores outputs on addresses the wallet cannot sign for', async () => {
    const inputs = await gather(
      [utxo(FOREIGN, 900_000_000n, 'aa'), utxo(mine[0]!, 50_000_000n, 'bb')],
      1_000_000n,
    )

    expect(inputs.map(i => i.txId)).toEqual(['bb'])
  })

  it('refuses the spend when every output is unsignable', async () => {
    vi.spyOn(walletService, 'getProvider').mockReturnValue(providerStub([utxo(FOREIGN, 900_000_000n, 'aa')]))

    await expect(
      walletService['gatherTransferInputs'](walletId, 'testnet', 1_000_000n),
    ).rejects.toThrow('No spendable funds')
  })

  it('honours fromAddress against the wallet-wide set', async () => {
    const inputs = await gather(
      [utxo(mine[0]!, 50_000_000n, 'aa'), utxo(mine[1]!, 50_000_000n, 'bb')],
      1_000_000n,
      mine[1],
    )

    expect(inputs.map(i => i.txId)).toEqual(['bb'])
  })
})
