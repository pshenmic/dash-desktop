import type {Knex} from 'knex'

// Platform (L2) addresses become rows, like L1 ones, instead of a count on the
// wallet. A row carries the address's own used flag and stops the whole list
// being re-derived from the xpub on every read.
//
// No backfill here: the addresses derive from platform_xpub, which needs the
// SDK. PlatformAddressService seeds the rows on its first window run and reads
// wallet.platform_address_count once as the floor, so a manually revealed
// address survives.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('platform_addresses', table => {
    table.string('wallet_id').notNullable()
    table.integer('address_index').notNullable()
    table.text('address').notNullable()
    table.text('derivation_path').notNullable()
    table.boolean('is_used').notNullable().defaultTo(false)
    table.primary(['wallet_id', 'address_index'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('platform_addresses')
}
