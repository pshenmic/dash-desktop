import {Wallet} from '../types/Wallet'
import {SHIELDED_ADDRESS_COUNT_DEFAULT, WALLET_SCOPED_TABLES} from '../constants'

function fromRow({wallet_id, label, network, encrypted_mnemonic, selected, platform_xpub, core_xpub}): Wallet {
  return {walletId: wallet_id, network, label, encryptedMnemonic: encrypted_mnemonic, selected: Boolean(selected), platformXpub: platform_xpub ?? null, coreXpub: core_xpub ?? null}
}

export class WalletDAO {
  knex

  constructor(knex) {
    this.knex = knex
  }

  saveWallet = async (mnemonic, walletId, network, label): Promise<void> => {
    await this.knex('wallet')
      .insert({
        network,
        label,
        encrypted_mnemonic: mnemonic,
        wallet_id: walletId
      })
  }

  getWalletById = async (walletId): Promise<Wallet | null> => {
    const rows = await this.knex('wallet')
      .select('encrypted_mnemonic', 'network', 'wallet_id', 'label', 'selected', 'platform_xpub', 'core_xpub')
      .where('wallet_id', walletId)
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    const [row] = rows

    return fromRow(row)
  }

  getAllWallets = async (): Promise<Wallet[]> => {
    const rows = await this.knex('wallet')
      .select('encrypted_mnemonic', 'network', 'wallet_id', 'label', 'selected', 'platform_xpub', 'core_xpub')

    return rows.map(fromRow)
  }

  getSelectedWallet = async (): Promise<Wallet | null> => {
    const rows = await this.knex('wallet')
      .select('encrypted_mnemonic', 'network', 'wallet_id', 'label', 'selected', 'platform_xpub', 'core_xpub')
      .where('selected', true)
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    return fromRow(rows[0])
  }

  setSelectedWallet = async (walletId: string): Promise<void> => {
    await this.knex('wallet')
      .where('selected', true)
      .update({selected: false})

    const result = await this.knex('wallet')
      .update({selected: true})
      .where('wallet_id', walletId)

    if (result === 0) {
      throw new Error('Wallet for select not found. No selected wallet at this moment')
    }
  }

  getShieldedAddressCount = async (walletId: string): Promise<number> => {
    const rows = await this.knex('wallet')
      .select('shielded_address_count')
      .where('wallet_id', walletId)
      .limit(1)

    if (rows.length === 0) {
      return SHIELDED_ADDRESS_COUNT_DEFAULT
    }

    return rows[0].shielded_address_count
  }

  setShieldedAddressCount = async (walletId: string, count: number): Promise<void> => {
    await this.knex('wallet')
      .update({shielded_address_count: count})
      .where('wallet_id', walletId)
  }

  // How far into the pool this wallet has trial-decrypted. Decoding always runs
  // as a prefix, so one cursor replaces a per-note flag.
  getShieldedDecodedCount = async (walletId: string): Promise<number> => {
    const rows = await this.knex('wallet')
      .select('shielded_decoded_count')
      .where('wallet_id', walletId)
      .limit(1)

    if (rows.length === 0) {
      return 0
    }

    return rows[0].shielded_decoded_count ?? 0
  }

  setShieldedDecodedCount = async (walletId: string, count: number): Promise<void> => {
    await this.knex('wallet')
      .update({shielded_decoded_count: count})
      .where('wallet_id', walletId)
  }

  // Legacy: how many platform addresses were revealed before they became rows.
  // Read once per wallet, by PlatformAddressService.seedLegacyWindow.
  getPlatformAddressCount = async (walletId: string): Promise<number> => {
    const rows = await this.knex('wallet')
      .select('platform_address_count')
      .where('wallet_id', walletId)
      .limit(1)

    if (rows.length === 0) {
      return 20
    }

    return rows[0].platform_address_count ?? 20
  }

  updateEncryptedMnemonic = async (walletId: string, encryptedMnemonic: string): Promise<void> => {
    await this.knex('wallet')
      .update({encrypted_mnemonic: encryptedMnemonic})
      .where('wallet_id', walletId)
  }

  setPlatformXpub = async (walletId: string, platformXpub: string): Promise<void> => {
    await this.knex('wallet')
      .update({platform_xpub: platformXpub})
      .where('wallet_id', walletId)
  }

  setCoreXpub = async (walletId: string, coreXpub: string): Promise<void> => {
    await this.knex('wallet')
      .update({core_xpub: coreXpub})
      .where('wallet_id', walletId)
  }

  updateLabel = async (walletId: string, label: string | null): Promise<void> => {
    const result = await this.knex('wallet')
      .update({label})
      .where('wallet_id', walletId)

    if (result === 0) {
      throw new Error('Wallet not found')
    }
  }

  getWalletsByNetwork = async (network): Promise<Wallet[]> => {
    const rows = await this.knex('wallet')
      .select('encrypted_mnemonic', 'network', 'wallet_id', 'label', 'selected', 'platform_xpub', 'core_xpub')
      .where('network', network)

    return rows.map(fromRow)
  }

  deleteWallet = async (walletId: string): Promise<void> => {
    await this.knex.transaction(async trx => {
      const target = await trx('wallet')
        .select('selected')
        .where('wallet_id', walletId)
        .first()
      const wasSelected = Boolean(target?.selected)

      for (const table of WALLET_SCOPED_TABLES) {
        await trx(table).delete().where('wallet_id', walletId)
      }

      await trx('wallet')
        .delete()
        .where('wallet_id', walletId)

      if (wasSelected) {
        const survivor = await trx('wallet')
          .select('wallet_id')
          .first()

        if (survivor != null) {
          await trx('wallet')
            .where('wallet_id', survivor.wallet_id)
            .update({selected: true})
        }
      }
    })
  }
}
