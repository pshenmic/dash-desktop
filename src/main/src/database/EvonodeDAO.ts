import type {Knex} from 'knex'
import {INSERT_CHUNK_SIZE} from '../constants/database'
import {chunk} from '../utils/chunk'
import {Network} from '../types/Network'

export class EvonodeDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getDapiUrls = async (): Promise<Map<Network, string[]>> => {
    const byNetwork = new Map<Network, string[]>()
    for (const {network, url} of await this.knex('evonodes').select('network', 'url')) {
      byNetwork.set(network, [...byNetwork.get(network) ?? [], url])
    }
    return byNetwork
  }

  replaceDapiUrls = async (network: Network, dapiUrls: string[]): Promise<void> => {
    await this.knex.transaction(async trx => {
      await trx('evonodes').where('network', network).delete()
      for (const urls of chunk(dapiUrls, INSERT_CHUNK_SIZE)) {
        await trx('evonodes').insert(urls.map(url => ({network, url})))
      }
    })
  }
}
