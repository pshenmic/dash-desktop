import type {Knex} from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', table => {
    table.text('kind').notNullable().defaultTo('core')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE contacts DROP COLUMN kind')
}
