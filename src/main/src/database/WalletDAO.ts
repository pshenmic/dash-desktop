import {Wallet} from '../types/Wallet'
import {QueryStatus} from "../types/QueryStatus";

function fromRow({wallet_id, label, network, encrypted_mnemonic, selected, platform_xpub}): Wallet {
  return {walletId: wallet_id, network, label, encryptedMnemonic: encrypted_mnemonic, selected: Boolean(selected), platformXpub: platform_xpub ?? null}
}

export class WalletDAO {
  knex

  constructor(knex) {
    this.knex = knex
  }

  saveWallet = async (mnemonic, walletId, network, label): Promise<QueryStatus> => {
    try {
      await this.knex('wallet')
        .insert({
          network,
          label,
          encrypted_mnemonic: mnemonic,
          wallet_id: walletId
        })

      return {
        success: true,
        errorMessage: null,
      }
    } catch (error) {
      let message: string

      if (error instanceof Error) {
        message = error.message
      } else {
        message = String(error)
      }

      return {
        success: false,
        errorMessage: message
      }
    }
  }

  getWalletById = async (walletId): Promise<Wallet | null> => {
    const rows = await this.knex('wallet')
      .select('encrypted_mnemonic', 'network', 'wallet_id', 'label', 'selected', 'platform_xpub')
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
      .select('encrypted_mnemonic', 'network', 'wallet_id', 'label', 'selected', 'platform_xpub')

    return rows.map(fromRow)
  }

  getSelectedWallet = async (): Promise<Wallet | null> => {
    const rows = await this.knex('wallet')
      .select('encrypted_mnemonic', 'network', 'wallet_id', 'label', 'selected', 'platform_xpub')
      .where('selected', true)
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    return fromRow(rows[0])
  }

  setSelectedWallet = async (walletId: string): Promise<QueryStatus> => {
    await this.knex('wallet')
      .where('selected', true)
      .update({selected: false})

    const result = await this.knex('wallet')
      .update({selected: true})
      .where('wallet_id', walletId)

    if (result > 0) {
      return {
        success: true,
        errorMessage: null,
      }
    } else {
      return {
        success: false,
        errorMessage: "Wallet for select not found. No selected wallet at this moment",
      }
    }
  }

  getShieldedAddressCount = async (walletId: string): Promise<number> => {
    const rows = await this.knex('wallet')
      .select('shielded_address_count')
      .where('wallet_id', walletId)
      .limit(1)

    if (rows.length === 0) {
      return 1
    }

    return rows[0].shielded_address_count
  }

  setShieldedAddressCount = async (walletId: string, count: number): Promise<void> => {
    await this.knex('wallet')
      .update({shielded_address_count: count})
      .where('wallet_id', walletId)
  }

  setPlatformXpub = async (walletId: string, platformXpub: string): Promise<void> => {
    await this.knex('wallet')
      .update({platform_xpub: platformXpub})
      .where('wallet_id', walletId)
  }

  updateLabel = async (walletId: string, label: string | null): Promise<QueryStatus> => {
    try {
      const result = await this.knex('wallet')
        .update({label})
        .where('wallet_id', walletId)

      if (result === 0) {
        return {
          success: false,
          errorMessage: 'Wallet not found',
        }
      }

      return {
        success: true,
        errorMessage: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      return {
        success: false,
        errorMessage: message,
      }
    }
  }

  getWalletsByNetwork = async (network): Promise<Wallet[]> => {
    const rows = await this.knex('wallet')
      .select('encrypted_mnemonic', 'network', 'wallet_id', 'label', 'selected', 'platform_xpub')
      .where('network', network)

    return rows.map(fromRow)
  }

  deleteWallet = async (walletId: string): Promise<QueryStatus> => {
    try {
      await this.knex('identities')
        .delete()
        .where('wallet_id', walletId)

      await this.knex('addresses')
        .delete()
        .where('wallet_id', walletId)

      await this.knex('wallet')
        .delete()
        .where('wallet_id', walletId)

      return {
        success: true,
        errorMessage: null,
      }
    } catch (error) {
      let message: string

      if (error instanceof Error) {
        message = error.message
      } else {
        message = String(error)
      }

      return {
        success: false,
        errorMessage: message
      }
    }
  }
}
