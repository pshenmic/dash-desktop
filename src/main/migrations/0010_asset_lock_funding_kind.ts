import type {Knex} from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset_lock_fundings', table => {
    table.text('kind').notNullable().defaultTo('address')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset_lock_fundings', table => {
    table.dropColumn('kind')
  })
}
