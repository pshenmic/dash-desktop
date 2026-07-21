import type {Knex} from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.integer('platform_address_count').notNullable().defaultTo(20)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('platform_address_count')
  })
}
