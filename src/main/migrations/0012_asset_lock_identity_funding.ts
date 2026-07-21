import type {Knex} from 'knex'

// Extend asset-lock fundings for the identity flow: identity_index records
// which identity the funding targets, and tx_hex stores the signed L1 tx so a
// funding can be rebroadcast/resumed after a post-broadcast failure. Both
// nullable — only identity-kind fundings populate them.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset_lock_fundings', table => {
    table.integer('identity_index').nullable()
    table.text('tx_hex').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset_lock_fundings', table => {
    table.dropColumn('identity_index')
    table.dropColumn('tx_hex')
  })
}
