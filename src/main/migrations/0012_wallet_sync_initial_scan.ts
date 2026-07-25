import type {Knex} from 'knex'

// Tracks whether a wallet has ever completed a full cfilter scan to the chain
// tip. Once true, any address the wallet derives afterwards is frontier-fresh
// and cannot carry pre-tip history, so hot-adding it must NOT rewind the scan
// cursor. While false (brand-new / restore in progress) gap-extension
// addresses may still have historical activity, so the rewind stands.
//
// Defaults to false; existing wallets get marked on their next completed sync.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet_sync_state', table => {
    table.boolean('initial_scan_complete').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet_sync_state', table => {
    table.dropColumn('initial_scan_complete')
  })
}