import type {Knex} from 'knex'

// Persist the account-level DIP-17 platform xpub on the wallet. Lets
// PlatformAddressService derive the L2 address list without a password;
// nullable so pre-existing wallets backfill it on next login.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.text('platform_xpub').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('platform_xpub')
  })
}
