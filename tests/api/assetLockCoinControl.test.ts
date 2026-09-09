import {describe, it, expect, beforeEach, vi} from 'vitest'
import {Script, utils as sdkUtils} from 'dash-core-sdk'
import {CoreLockService} from '../../src/main/src/services/core/CoreLockService'
import {WalletService} from '../../src/main/src/services/wallet/WalletService'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletProvider} from '../../src/main/src/providers/WalletProvider'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {CoreSpendSource} from '../../src/main/src/types/CoinSelection'
import {UTXO} from '../../src/main/src/types/UTXO'
import {unlockWallet} from '../../src/main/src/utils/walletSeed'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

// Signing checks the scriptPubKey against the address's key, so a stand-in
// hex would fail before the selection could be observed.
const p2pkhScript = (address: string): Script => {
  const script = new Script()
  script.pushOpCode('OP_DUP')
  script.pushOpCode('OP_HASH160')
  script.pushOpCode('OP_PUSHBYTES_20', sdkUtils.addressToPublicKeyHash(address))
  script.pushOpCode('OP_EQUALVERIFY')
  script.pushOpCode('OP_CHECKSIG')
  return script
}

const utxo = (address: string, satoshis: bigint, txId: string): UTXO =>
  ({address, satoshis, txId, vOut: 0, script: p2pkhScript(address), height: 2_300_000})

const providerStub = (utxos: UTXO[]): WalletProvider => ({
  getWalletUtxos: async () => utxos,
  getWalletBalance: async () => 0n,
  getBalance: async () => 0n,
  ensureReady: async () => undefined,
  getConnectionStatus: async () => 'online',
  scanAddressUsage: async () => null,
  getUsedAddresses: async () => [],
  getWalletTransactions: async () => [],
  getAddressInfos: async () => [],
  getTransactionByHash: async () => { throw new Error('unused') },
  getTxLockStatus: async () => ({instantLocked: false, chainlocked: false, confirmed: false}),
  nextUnusedAddress: async () => '',
})

const txid = (byte: string): string => byte.repeat(32)

const outpointsOf = (...txIds: string[]): CoreSpendSource =>
  ({kind: 'outpoints', outpoints: txIds.map(t => ({txid: t, vout: 0}))})

describe('funding an asset lock from picked coins', () => {
  let coreLockService: CoreLockService
  let walletService: WalletService
  let providers: WalletProviderFactory
  let createWalletHandler: CreateWalletHandler
  let walletId: string
  let seed: Uint8Array
  let owned: string[]

  beforeEach(async () => {
    const wired = await harness()
    coreLockService = wired.coreLockService
    walletService = wired.walletService
    providers = wired.providers
    createWalletHandler = wired.createWalletHandler
    walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    seed = (await unlockWallet(wired.walletDAO, walletId, PASSWORD)).seed
    const grouped = await walletService.getAddressesByWalletId(walletId)
    owned = grouped.receiving.slice(0, 3).map(a => a.address)
  })

  // The lock binds the coins it spends to its L2 destination for good, so a
  // pick that the funding then ignored would leak the link it was made to avoid.
  it('spends exactly the coins picked, not the ones the amount would have taken', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([
      utxo(owned[0], 100_000_000n, txid('aa')),
      utxo(owned[1], 20_000_000n, txid('bb')),
      utxo(owned[2], 20_000_000n, txid('cc')),
    ]))

    const built = await coreLockService.buildAssetLock(walletId, 1_000_000n, seed, undefined, outpointsOf(txid('bb'), txid('cc')))

    expect(built.tx.inputs.map(i => i.txId)).toEqual([txid('bb'), txid('cc')])
  })

  it('still selects automatically when nothing was picked', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([
      utxo(owned[0], 100_000_000n, txid('aa')),
      utxo(owned[1], 20_000_000n, txid('bb')),
    ]))

    const built = await coreLockService.buildAssetLock(walletId, 1_000_000n, seed)

    expect(built.tx.inputs.map(i => i.txId)).toEqual([txid('aa')])
  })

  it('refuses a pick that cannot cover the lock and its fee', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([
      utxo(owned[0], 100_000_000n, txid('aa')),
      utxo(owned[1], 10_000n, txid('bb')),
    ]))

    await expect(coreLockService.buildAssetLock(walletId, 1_000_000n, seed, undefined, outpointsOf(txid('bb'))))
      .rejects.toThrow('Insufficient funds')
  })
})
