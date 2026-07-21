import type {Knex} from 'knex'

// Derivation columns on the wallet, added together (the `wallet` table itself
// is created in 0000_init):
//   platform_xpub            account-level DIP-17 L2 xpub — derive the platform
//                            address list without a password (nullable;
//                            backfilled on next login for pre-existing wallets)
//   core_xpub                account-level L1 xpub, same purpose for core
//                            addresses (nullable; backfilled on login)
//   platform_address_count   revealed L2 addresses (DIP-17 lookahead, def 20)
//   shielded_address_count   revealed Orchard addresses (initial batch, def 5)

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