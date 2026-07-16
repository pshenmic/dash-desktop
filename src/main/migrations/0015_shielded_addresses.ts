import type {Knex} from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shielded_addresses', table => {
    table.string('wallet_id').notNullable()
    table.integer('address_index').notNullable()
    table.text('address').notNullable()
    table.primary(['wallet_id', 'address_index'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('shielded_addresses')
}
