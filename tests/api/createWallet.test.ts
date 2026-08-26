import {describe, it, expect, beforeEach, vi} from 'vitest'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {CORE_ADDRESS_WINDOW} from '../../src/main/src/constants'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

describe('CreateWalletHandler', () => {
  let handler: CreateWalletHandler
  let walletDAO: WalletDAO
  let addressDAO: AddressDAO
  let identityDAO: IdentityDAO
  let request: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    const wired = await harness()
    handler = wired.createWalletHandler
    walletDAO = wired.walletDAO
    addressDAO = wired.addressDAO
    identityDAO = new IdentityDAO(wired.knex)
    request = wired.request
  })

  it('returns an 8-char hex walletId', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    expect(walletId).toMatch(/^[0-9a-f]{8}$/)
  })

  it('persists the wallet with encrypted mnemonic', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const wallet = await walletDAO.getWalletById(walletId)

    expect(wallet).not.toBeNull()
    expect(wallet!.walletId).toBe(walletId)
    expect(wallet!.network).toBe('testnet')
    expect(wallet!.label).toBeNull()
    expect(wallet!.encryptedMnemonic).toMatch(/^[0-9a-f]+$/)
  })

  it('inserts the initial lookahead window for receiving and change addresses', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const {receiving, change} = await addressDAO.getAddressesByWalletId(walletId)

    expect(receiving).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
    expect(change).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
  })

  it('generates testnet receiving addresses with the BIP-44 testnet path', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)

    receiving.forEach((a, i) => {
      expect(a.isChange).toBe(false)
      expect(a.derivationPath).toBe(`m/44'/1'/0'/0/${i}`)
    })
  })

  it('generates testnet change addresses with the BIP-44 testnet path', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const {change} = await addressDAO.getAddressesByWalletId(walletId)

    change.forEach((a, i) => {
      expect(a.isChange).toBe(true)
      expect(a.derivationPath).toBe(`m/44'/1'/0'/1/${i}`)
    })
  })

  it('uses coin type 5 for mainnet', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'mainnet', PASSWORD)

    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)

    expect(receiving[0].derivationPath).toMatch(/^m\/44'\/5'\//)
  })

  it('persists the platform account xpub for the new wallet', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const wallet = await walletDAO.getWalletById(walletId)

    expect(wallet!.platformXpub).not.toBeNull()
  })

  it('records the identities the seed already owns on Platform', async () => {
    request.mockResolvedValue({
      identities: [{index: 0, identifier: 'identifierABC'}, {index: 2, identifier: 'identifierXYZ'}],
      nextFreeIndex: 1,
    })

    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const identities = await identityDAO.getIdentitiesByWalletId(walletId)
    expect(identities.map(i => [i.identityIndex, i.identifier])).toEqual([[0, 'identifierABC'], [2, 'identifierXYZ']])
  })

  // The wallet row and its addresses are written before the scan runs, so
  // aborting here would leave them behind and a retry would mint a second
  // wallet for the same seed.
  it('still creates the wallet when the identity scan cannot reach the worker', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    request.mockRejectedValue(new Error('platform worker exited'))

    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    expect(walletId).toMatch(/^[0-9a-f]{8}$/)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    expect(receiving).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
  })

  it('rejects a seedphrase with wrong word count', async () => {
    await expect(
      handler.handle(null as never, 'too short', 'testnet', PASSWORD),
    ).rejects.toThrow('Seedphrase must be 12, 15, 18, 21, or 24 words')
  })

  it('rejects an invalid network', async () => {
    await expect(
      handler.handle(null as never, VALID_SEEDPHRASE, 'invalidnet' as never, PASSWORD),
    ).rejects.toThrow('Invalid network')
  })
})
