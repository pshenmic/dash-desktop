import type {Knex} from 'knex'
import {Address} from '../types/Address'
import {DashPayAddress, DashPayDirection} from '../types/DashPay'
import {GroupedAddresses} from "../types/GroupedAddresses";
import {INSERT_CHUNK_SIZE, SELECT_CHUNK_SIZE} from '../constants/database'
import {chunk} from '../utils/chunk'
import {dashPayAddressPath} from '../utils/dashPayKeys'

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
    for (const rows of chunk(addresses, INSERT_CHUNK_SIZE)) {
      await this.knex('addresses').insert(
        rows.map(e => ({
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
  }

  getAddressesByWalletId = async (walletId: string): Promise<GroupedAddresses> => {
    const rows = await this.knex('addresses')
      .select('wallet_id', 'account_id', 'address', 'derivation_path', 'index', 'is_change', 'is_used', 'label')
      .where('wallet_id', walletId)
      .orderBy('index', 'asc')
    // The path needs the coin type, which only the wallet row carries.
    const dashPay = (await this.knex('dashpay_contact_addresses')
      .join('wallet', 'wallet.wallet_id', 'dashpay_contact_addresses.wallet_id')
      .select('dashpay_contact_addresses.*', 'wallet.network')
      .where({'dashpay_contact_addresses.wallet_id': walletId, direction: 'receiving'})
      .orderBy('address_index', 'asc'))
      .map((row): Address => ({
        walletId,
        accountId: 0,
        address: row.address,
        derivationPath: dashPayAddressPath(row.network, row.identifier, row.contact_id, row.address_index),
        index: row.address_index,
        isChange: false,
        isUsed: Boolean(row.is_used),
        label: null,
      }))

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
    }, {receiving: [], change: [], dashPay})
  }

  markAddressesUsed = async (walletId: string, isChange: boolean, indexes: number[]): Promise<void> => {
    for (const slice of chunk(indexes, SELECT_CHUNK_SIZE)) {
      await this.knex('addresses')
        .where('wallet_id', walletId)
        .andWhere('is_change', isChange)
        .whereIn('index', slice)
        .update({is_used: true})
    }
  }

  getDashPayAddresses = async (walletId: string, identifier: string, contactId: string, direction: DashPayDirection): Promise<DashPayAddress[]> => {
    const rows = await this.knex('dashpay_contact_addresses')
      .where({wallet_id: walletId, identifier, contact_id: contactId, direction})
      .orderBy('address_index', 'asc')
    return rows.map(row => ({
      walletId, identifier, contactId, direction, index: row.address_index, address: row.address, isUsed: Boolean(row.is_used),
    }))
  }

  insertDashPayAddresses = async (addresses: DashPayAddress[]): Promise<void> => {
    for (const rows of chunk(addresses, INSERT_CHUNK_SIZE)) {
      await this.knex('dashpay_contact_addresses').insert(rows.map(a => ({
        wallet_id: a.walletId,
        identifier: a.identifier,
        contact_id: a.contactId,
        direction: a.direction,
        address_index: a.index,
        address: a.address,
        is_used: a.isUsed,
      })))
    }
  }

  markDashPayAddressesUsed = async (walletId: string, identifier: string, contactId: string, direction: DashPayDirection, indexes: number[]): Promise<void> => {
    for (const slice of chunk(indexes, SELECT_CHUNK_SIZE)) {
      await this.knex('dashpay_contact_addresses')
        .where({wallet_id: walletId, identifier, contact_id: contactId, direction})
        .whereIn('address_index', slice)
        .update({is_used: true})
    }
  }

  setAddressLabel = async (walletId: string, address: string, label: string): Promise<void> => {
    const result = await this.knex('addresses')
      .where('address', address)
      .andWhere('wallet_id', walletId)
      .update({
        label: label
      })

    if (result === 0) {
      throw new Error('address or wallet not found')
    }
  }
}
