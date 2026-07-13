import type {Knex} from 'knex'

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
