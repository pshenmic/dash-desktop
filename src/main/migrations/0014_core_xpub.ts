import type {Knex} from 'knex'

// Persist the account-level core (L1) xpub on the wallet, mirroring
// platform_xpub. Lets core address derivation run without a password;
// nullable so pre-existing wallets backfill it on next login.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.text('core_xpub').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('core_xpub')
  })
}
