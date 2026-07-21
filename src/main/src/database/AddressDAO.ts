import type {Knex} from 'knex'
import {Address} from '../types/Address'
import {GroupedAddresses} from "../types/GroupedAddresses";
import {QueryStatus} from "../types/QueryStatus";

function fromRow({wallet_id, account_id, address, derivation_path, index, is_change, is_used, label}): Address {
  return {
    walletId: wallet_id,
    accountId: account_id,
    address,
    derivationPath: derivation_path,
    index,
    isChange: Boolean(is_change),
    isUsed: Boolean(is_used),
    balance: null,
    label
  }
}

export class AddressDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  insertAddresses = async (addresses: Address[]): Promise<void> => {
    await this.knex('addresses').insert(
      addresses.map(e => ({
        wallet_id: e.walletId,
        account_id: e.accountId,
        address: e.address,
        derivation_path: e.derivationPath,
        index: e.index,
        is_change: e.isChange,
        label: e.label,
      }))
    )
  }

  getAddressesByWalletId = async (walletId: string): Promise<GroupedAddresses> => {
    const rows = await this.knex('addresses')
      .select('wallet_id', 'account_id', 'address', 'derivation_path', 'index', 'is_change', 'is_used', 'label')
      .where('wallet_id', walletId)
      .orderBy('index', 'asc')

    return rows.reduce((acc, row) => {
      const address = fromRow(row)
      if (Boolean(row.is_change) === true) {
        return {
          ...acc,
          change: [...acc.change, address],
        }
      } else {
        return {
          ...acc,
          receiving: [...acc.receiving, address],
        }
      }
    }, {receiving: [], change: []})
  }

  markAddressesUsed = async (walletId: string, addresses: string[]): Promise<void> => {
    if (addresses.length === 0) return
    await this.knex('addresses')
      .where('wallet_id', walletId)
      .whereIn('address', addresses)
      .update({is_used: true})
  }

  setAddressLabel = async (walletId: string, address: string, label: string): Promise<QueryStatus> => {
    const result = await this.knex('addresses')
      .where('address', address)
      .andWhere('wallet_id', walletId)
      .update({
        label: label
      })

    if (result > 0) {
      return {
        success: true,
        errorMessage: null,
      }
    } else {
      return {
        success: false,
        errorMessage: "address or wallet not found",
      }
    }

  }
}
