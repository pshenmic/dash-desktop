import type {Knex} from 'knex'

// Account-level xpubs (DIP-17 for platform, L1 for core) let the address lists
// derive without a password. Both are nullable and backfilled on next login for
// wallets created before this migration. The *_count columns track how many
// addresses have been revealed.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.text('platform_xpub').nullable()
    table.text('core_xpub').nullable()
    table.integer('platform_address_count').notNullable().defaultTo(20)
    table.integer('shielded_address_count').notNullable().defaultTo(5)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('platform_xpub')
    table.dropColumn('core_xpub')
    table.dropColumn('platform_address_count')
    table.dropColumn('shielded_address_count')
  })
}