import type {Knex} from 'knex'

// Pending transactions now come from two places: our own broadcasts, and
// payments the lock pool sees in the mempool. Only the former may be
// re-pushed — rebroadcasting a stranger's transaction on a timer would relay
// it for as long as it stays unconfirmed. Existing rows are all local.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transactions', table => {
    table.boolean('is_local').notNullable().defaultTo(true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transactions', table => {
    table.dropColumn('is_local')
  })
}
