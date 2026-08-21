import type {Knex} from 'knex'

// Only our own outputs are stored, so an input spending someone else's coins has
// nothing to join to. These cache what its parent transaction says instead.
// prev_missing is the answer for a parent that came back without the output the
// input names — a retry reads the same bytes, so it is never asked again.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_inputs', table => {
    table.text('prev_address')
    table.text('prev_satoshis')
    table.boolean('prev_missing').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_inputs', table => {
    table.dropColumn('prev_address')
    table.dropColumn('prev_satoshis')
    table.dropColumn('prev_missing')
  })
}
