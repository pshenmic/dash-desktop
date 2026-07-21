import type {Knex} from 'knex'

// Track how many shielded (Orchard) addresses a wallet has revealed, so the
// derived-address list survives restarts. Defaults to 5 — the initial batch
// shown for a fresh wallet.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.integer('shielded_address_count').notNullable().defaultTo(5)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('shielded_address_count')
  })
}
