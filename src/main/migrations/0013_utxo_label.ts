import type {Knex} from 'knex'

// User-editable label for a single unspent output, set from the UTXOs page.
// Scoped to the outpoint rather than the address so two outputs paying the
// same address can be labelled apart. Independent of addresses.label, which
// keeps its own address-wide meaning.
//
// Nullable and never written by the sync path — output inserts are
// onConflict().ignore(), so replaying a tx cannot clobber a label.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_outputs', table => {
    table.text('label')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_outputs', table => {
    table.dropColumn('label')
  })
}
