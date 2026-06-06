import { describe, it, expect, beforeAll } from 'vitest'
import { CreateWalletHandler } from '../../src/main/src/api/wallet/CreateWallet'
import { DashPlatformSDK } from 'dash-platform-sdk'
import { getKnex, migrateKnex } from '../../src/main/src/utils'
import { WalletDAO } from '../../src/main/src/database/WalletDAO'
import { AddressDAO } from '../../src/main/src/database/AddressDAO'
import { WalletService } from '../../src/main/src/services/WalletService'
import path from 'path'

const VALID_SEEDPHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'password123'

describe('CreateWalletHandler', () => {
  let handler: CreateWalletHandler
  let walletDAO: WalletDAO
  let addressDAO: AddressDAO
  let sdk: DashPlatformSDK

  beforeAll(async () => {
    const knex = getKnex()

    await migrateKnex(knex, path.join(process.cwd(), 'src/main/migrations'))

    walletDAO = new WalletDAO(knex)
    addressDAO = new AddressDAO(knex)
    sdk = new DashPlatformSDK()

    const walletService = new WalletService(walletDAO, addressDAO, sdk)
    handler = new CreateWalletHandler(walletService)
  })

  it('should return a hex walletId', async () => {
    const walletId = await handler.handle(null as any, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    expect(walletId).toMatch(/^[0-9a-f]{32}$/)
  })

  it('should persist the wallet with encrypted mnemonic', async () => {
    const walletId = await handler.handle(null as any, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const wallet = await walletDAO.getWalletById(walletId)

    expect(wallet).toBeDefined()
    expect(wallet.walletId).toBe(walletId)
    expect(wallet.network).toBe('testnet')
    expect(wallet.label).toBeNull()
    expect(wallet.encryptedMnemonic).toMatch(/^[0-9a-f]+$/)
  })

  it('should insert 40 addresses (20 receiving + 20 change)', async () => {
    const walletId = await handler.handle(null as any, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const addresses = await addressDAO.getAddressesByWalletId(walletId)

    expect(addresses).toHaveLength(40)
  })

  it('should generate 20 receiving addresses with isChange=false', async () => {
    const walletId = await handler.handle(null as any, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const addresses = await addressDAO.getAddressesByWalletId(walletId)

    const receiving = addresses.filter((a) => !a.isChange)

    expect(receiving).toHaveLength(20)

    receiving.forEach((a, i) => {
      expect(a.derivationPath).toBe(`m/44'/1'/0'/0/${i}`)
    })
  })

  it('should generate 20 change addresses with isChange=true', async () => {
    const walletId = await handler.handle(null as any, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const addresses = await addressDAO.getAddressesByWalletId(walletId)

    const change = addresses.filter((a) => a.isChange)

    expect(change).toHaveLength(20)

    change.forEach((a, i) => {
      expect(a.derivationPath).toBe(`m/44'/1'/0'/1/${i}`)
    })
  })

  it('should use coin type 5 for mainnet', async () => {
    const walletId = await handler.handle(null as any, VALID_SEEDPHRASE, 'mainnet', PASSWORD)

    const addresses = await addressDAO.getAddressesByWalletId(walletId)

    expect(addresses[0].derivationPath).toMatch(/^m\/44'\/5'\//)
  })

  it('should throw on seedphrase with wrong word count', async () => {
    await expect(
      handler.handle(null as any, 'too short', 'testnet', PASSWORD)
    ).rejects.toThrow('Seedphrase must be 12, 15, 18, 21, or 24 words')
  })

  it('should throw on invalid network', async () => {
    await expect(
      handler.handle(null as any, VALID_SEEDPHRASE, 'invalidnet' as any, PASSWORD)
    ).rejects.toThrow('Invalid network')
  })
})