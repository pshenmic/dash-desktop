import {describe, it, expect, beforeEach, vi} from 'vitest'
import {WalletService} from '../../src/main/src/services/WalletService'
import {Knex} from 'knex'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletProvider} from '../../src/main/src/providers/WalletProvider'
import {AddressUsage} from '../../src/main/src/types/AddressDiscovery'
import {deriveCorePublicKey} from '../../src/main/src/utils/addressDiscovery'
import {ADDRESS_LOOKAHEAD} from '../../src/main/src/constants'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const usage = (isChange: boolean, index: number, isUsed: boolean): AddressUsage =>
  ({isChange, index, isUsed})

// Everything discovery does not reach on the scan path.
const providerStub = (scan: AddressUsage[] | null): WalletProvider => ({
  scanAddressUsage: async () => scan,
  getUsedAddresses: async () => [],
  getWalletTransactions: async () => [],
  getAddressInfos: async () => [],
  getWalletBalance: async () => 0n,
  getBalance: async () => 0n,
  getTransactionByHash: async () => { throw new Error('unused') },
  getWalletUtxos: async () => [],
  getTxLockStatus: async () => ({instantLocked: false, chainlocked: false, confirmed: false}),
  ensureReady: async () => undefined,
  nextUnusedAddress: async () => '',
})

describe('address discovery from an xpub scan', () => {
  let walletService: WalletService
  let walletDAO: WalletDAO
  let addressDAO: AddressDAO
  let createWalletHandler: CreateWalletHandler
  let knex: Knex
  let walletId: string

  beforeEach(async () => {
    const wired = await harness()
    walletService = wired.walletService
    walletDAO = wired.walletDAO
    addressDAO = wired.addressDAO
    createWalletHandler = wired.createWalletHandler
    knex = wired.knex
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
  })

  const runWith = async (scan: AddressUsage[] | null): Promise<void> => {
    vi.spyOn(walletService, 'getProvider').mockReturnValue(providerStub(scan))
    await walletService.discoverCoreAddresses(walletId)
  }

  it('marks the addresses the scan reports as used', async () => {
    const before = await addressDAO.getAddressesByWalletId(walletId)
    expect(before.receiving.filter(a => a.isUsed)).toHaveLength(0)

    await runWith([usage(false, 0, true), usage(false, 3, true)])

    const after = await addressDAO.getAddressesByWalletId(walletId)
    expect(after.receiving.filter(a => a.isUsed).map(a => a.index)).toEqual([0, 3])
    expect(after.change.filter(a => a.isUsed)).toHaveLength(0)
  })

  it('extends the window to the last used index plus the lookahead', async () => {
    await runWith([usage(false, 60, true)])

    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const highest = Math.max(...receiving.map(a => a.index))
    expect(highest).toBe(60 + ADDRESS_LOOKAHEAD)
  })

  // The endpoint returns every index it walked, not just the used ones.
  it('fills the whole window from a contiguous scan', async () => {
    const scan = Array.from({length: 111}, (_, index) => usage(false, index, index === 60))

    await runWith(scan)

    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const indexes = receiving.map(a => a.index).sort((a, b) => a - b)

    expect(indexes).toEqual(Array.from({length: 111}, (_, i) => i))
    expect(receiving.find(a => a.index === 60)?.isUsed).toBe(true)
  })

  it('derives every new address from our own xpub', async () => {
    await runWith([usage(false, 60, true)])

    const wallet = await walletDAO.getWalletById(walletId)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const derived = receiving.find(a => a.index === 75)!

    const publicKey = deriveCorePublicKey(wallet!.coreXpub!, 'testnet', false, 75)
    expect(derived.address).toBe(walletService['keyPair'].p2pkhAddress(publicKey, 'testnet'))
    expect(derived.derivationPath).toBe("m/44'/1'/0'/0/75")
  })

  // Nothing drops an index today; discovery is what would put one back.
  it('refills a hole below the frontier', async () => {
    await knex('addresses').where({wallet_id: walletId, is_change: false, index: 7}).delete()

    await runWith([usage(false, 0, true)])

    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const restored = receiving.find(a => a.index === 7)

    expect(restored).toBeDefined()
    const wallet = await walletDAO.getWalletById(walletId)
    const publicKey = deriveCorePublicKey(wallet!.coreXpub!, 'testnet', false, 7)
    expect(restored!.address).toBe(walletService['keyPair'].p2pkhAddress(publicKey, 'testnet'))
  })

  it('leaves the window alone when nothing in the scan is used', async () => {
    const before = await addressDAO.getAddressesByWalletId(walletId)

    await runWith([usage(false, 0, false), usage(true, 0, false)])

    const after = await addressDAO.getAddressesByWalletId(walletId)
    expect(after.receiving).toHaveLength(before.receiving.length)
    expect(after.change).toHaveLength(before.change.length)
  })

  it('widens round by round when the provider cannot scan', async () => {
    const provider = providerStub(null)
    const getUsedAddresses = vi.spyOn(provider, 'getUsedAddresses')
    vi.spyOn(walletService, 'getProvider').mockReturnValue(provider)

    await walletService.discoverCoreAddresses(walletId)

    expect(getUsedAddresses).toHaveBeenCalled()
  })
})
