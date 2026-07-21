import type {Knex} from 'knex'

// Track how many DIP-17 platform (L2) addresses a wallet has derived, so the
// address list survives restarts. Defaults to 20 — the DIP-17 lookahead.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.integer('platform_address_count').notNullable().defaultTo(20)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('platform_address_count')
  })
}
