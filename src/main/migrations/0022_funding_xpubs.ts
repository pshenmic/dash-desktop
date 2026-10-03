import type {Knex} from 'knex'

// DIP-13 identity funding xpubs (m/9'/coin'/5'/1' registration, m/9'/coin'/5'/2'
// top-up) let an asset lock's credit output be matched to its key without a
// password. Nullable and backfilled on next unlock, as platform_xpub was.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.text('registration_funding_xpub').nullable()
    table.text('topup_funding_xpub').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('registration_funding_xpub')
    table.dropColumn('topup_funding_xpub')
  })
}
