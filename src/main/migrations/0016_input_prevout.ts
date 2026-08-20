import type {Knex} from 'knex'

// Only our own outputs are stored, so an input spending someone else's coins has
// nothing to join to and shows up with no address and a zero value. These two
// columns cache what the parent transaction says, once it has been read back
// from the network.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_inputs', table => {
    table.text('prev_address')
    table.text('prev_satoshis')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_inputs', table => {
    table.dropColumn('prev_address')
    table.dropColumn('prev_satoshis')
  })
}
