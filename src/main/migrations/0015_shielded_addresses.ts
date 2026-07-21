import type {Knex} from 'knex'

// Cache derived shielded (Orchard) addresses per wallet, keyed by their
// derivation index, so the revealed address list can be shown without
// re-deriving from the seed (which needs the password) on every load.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shielded_addresses', table => {
    table.string('wallet_id').notNullable()
    table.integer('address_index').notNullable()
    table.text('address').notNullable()
    table.primary(['wallet_id', 'address_index'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('shielded_addresses')
}
