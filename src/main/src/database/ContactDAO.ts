import type {Knex} from 'knex'
import {Contact} from '../types/Contact'
import {Network} from '../types'
import {QueryStatus} from '../types/QueryStatus'
import {isConstraintViolation} from './errors'

function fromRow({id, label, address, network, created_at}): Contact {
  return {id, label, address, network, createdAt: created_at}
}

export class ContactDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getContacts = async (network?: Network): Promise<Contact[]> => {
    const query = this.knex('contacts')
      .select('id', 'label', 'address', 'network', 'created_at')
      .orderBy('created_at', 'desc')

    if (network != null) {
      query.where('network', network)
    }

    const rows = await query
    return rows.map(fromRow)
  }

  insertContact = async (
    label: string,
    address: string,
    network: Network,
    createdAt: number,
  ): Promise<QueryStatus> => {
    try {
      await this.knex('contacts').insert({label, address, network, created_at: createdAt})
      return {success: true, errorMessage: null}
    } catch (error) {
      // The only constraint a well-formed insert can violate is the
      // (address, network) unique index — the rest are NOT NULL columns the
      // signature always supplies and a CHECK on a typed union.
      if (isConstraintViolation(error)) {
        return {success: false, errorMessage: 'This address is already in your address book'}
      }
      console.error('[contacts] failed to add contact:', error)
      return {success: false, errorMessage: 'Failed to add contact'}
    }
  }

  deleteContact = async (id: number): Promise<QueryStatus> => {
    const result = await this.knex('contacts').where('id', id).delete()
    if (result > 0) {
      return {success: true, errorMessage: null}
    }
    return {success: false, errorMessage: 'Contact not found'}
  }
}
