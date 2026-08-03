import type {Knex} from 'knex'

// One row per L1 asset-lock funding a platform destination, keyed by the
// funding txid. The status stages (l1_broadcast -> chainlocked -> st_broadcast
// -> done/error) are what lets an interrupted funding resume after a restart,
// with tx_hex carrying the signed L1 tx it resumes from.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('asset_lock_fundings', table => {
    table.increments('id').primary()
    table.text('wallet_id').notNullable()
    table.text('txid').notNullable()
    table.integer('output_index').notNullable()
    table.text('credit_derivation_path').notNullable()
    table.text('amount_duffs').notNullable()
    table.text('to_platform_address').notNullable()
    table.text('status').notNullable().checkIn(['l1_broadcast', 'chainlocked', 'st_broadcast', 'done', 'error'])
    table.text('st_hash')
    table.text('error')
    table.integer('created_at').notNullable().defaultTo(0)
    table.text('kind').notNullable().defaultTo('address')
    table.integer('identity_index').nullable()
    table.text('tx_hex').nullable()

    table.index('wallet_id', 'asset_lock_fundings_wallet_idx')
    table.unique(['txid'], { useConstraint: true })
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('asset_lock_fundings')
}
