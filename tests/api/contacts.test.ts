import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import type {Knex} from 'knex'
import {base58, bech32m} from '@scure/base'
import {ContactDAO} from '../../src/main/src/database/ContactDAO'
import {ContactService} from '../../src/main/src/services/app/ContactService'
import {UpdateContactHandler} from '../../src/main/src/api/contacts/updateContact'
import {getKnex, migrateKnex} from '../../src/main/src/utils'
import {ContactKind} from '../../src/main/src/types/Contact'
import {up, down} from '../../src/main/migrations/0020_contact_kind'

describe('contacts', () => {
  let knex: Knex
  let service: ContactService
  let update: UpdateContactHandler

  beforeEach(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    service = new ContactService(new ContactDAO(knex))
    update = new UpdateContactHandler(service)
  })
  afterEach(async () => { await knex.destroy() })

  it.each<[ContactKind, string]>([
    ['core', 'yPx8DNt1oQt3yubB2Sh73vAQRQ1AoyyLCS'],
    ['platform', bech32m.encode('tdash', bech32m.toWords(new Uint8Array(21)))],
    ['shielded', bech32m.encode('tdash', bech32m.toWords(new Uint8Array([16, ...new Uint8Array(43)])))],
    ['identity', base58.encode(new Uint8Array(32).fill(7))],
  ])('persists and returns a %s contact type', async (kind, address) => {
    await service.addContact(` ${kind} `, ` ${address} `, 'testnet', kind)
    expect(await service.getContacts('testnet')).toEqual([
      {id: expect.any(Number), label: kind, address, kind, network: 'testnet', createdAt: expect.any(Number)},
    ])
  })

  it('defaults existing add callers to Core without imposing format validation', async () => {
    await service.addContact('Name', 'arbitrary nonempty value', 'testnet')
    expect((await service.getContacts())[0]).toMatchObject({kind: 'core', address: 'arbitrary nonempty value'})
  })

  it('edits name, address and type, preserving ID, network and creation time', async () => {
    await knex('contacts').insert({id: 8, label: 'Before', address: 'original', network: 'mainnet', created_at: 123})
    await update.handle({} as never, 8, ' After ', ' changed ', 'shielded')
    expect(await service.getContacts()).toEqual([{id: 8, label: 'After', address: 'changed', kind: 'shielded', network: 'mainnet', createdAt: 123}])
  })

  it('rejects duplicate adds and edits on the same network without losing the edited entry', async () => {
    await service.addContact('First', 'first', 'testnet')
    await service.addContact('Second', 'second', 'testnet')
    const before = await service.getContacts()
    const second = before.find(contact => contact.address === 'second')!
    await expect(service.addContact('Duplicate', 'first', 'testnet')).rejects.toThrow('already in your address book')
    await expect(update.handle({} as never, second.id, 'Duplicate', 'first', 'core')).rejects.toThrow('already in your address book')
    expect(await service.getContacts()).toEqual(before)
    await service.addContact('Other network', 'first', 'mainnet')
    expect(await service.getContacts('mainnet')).toHaveLength(1)
  })

  it('rejects an empty edit and a missing contact', async () => {
    await service.addContact('Original', 'address', 'testnet')
    const [contact] = await service.getContacts()
    await expect(update.handle({} as never, contact.id, ' ', 'address', 'core')).rejects.toThrow('Label is required')
    await expect(update.handle({} as never, contact.id, 'Name', ' ', 'core')).rejects.toThrow('Address is required')
    await expect(update.handle({} as never, 999, 'Name', 'address', 'core')).rejects.toThrow('Contact not found')
    expect(await service.getContacts()).toEqual([contact])
  })

  it('rejects unknown contact types on add and update', async () => {
    await service.addContact('Original', 'address', 'testnet')
    const [contact] = await service.getContacts()
    await expect(service.addContact('Invalid', 'other', 'testnet', 'unknown' as ContactKind)).rejects.toThrow('Invalid contact type')
    await expect(update.handle({} as never, contact.id, 'Invalid', 'other', 'unknown' as ContactKind)).rejects.toThrow('Invalid contact type')
    expect(await service.getContacts()).toEqual([contact])
  })

  it('adds Core to existing records without changing their data and supports rollback', async () => {
    await down(knex)
    const original = {id: 9, label: 'Legacy', address: 'original', network: 'testnet', created_at: 123}
    await knex('contacts').insert(original)
    await up(knex)
    expect(await knex('contacts')).toEqual([{...original, kind: 'core'}])
    await down(knex)
    expect(await knex('contacts')).toEqual([original])
  })
})
