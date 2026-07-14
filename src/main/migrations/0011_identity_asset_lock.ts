import type {Knex} from 'knex'

// asset_lock_txid records the L1 asset-lock transaction that funded an
// identity's registration. Persisted alongside the identity before the Platform
// state transition is broadcast, so a crash leaves a recoverable record of the
// committed lock (the credit output is owned by the seed-derived registration
// key, so funds are recoverable independently).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('identities', table => {
    table.text('asset_lock_txid').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('identities', table => {
    table.dropColumn('asset_lock_txid')
  })
}
