import type {Knex} from 'knex'

// Local spent-note bookkeeping for the shielded (Orchard) pool. Records which
// owned note indices have been spent so the wallet can hide them from the
// spendable set without re-deriving nullifiers from the seed on every load.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shielded_spent_notes', table => {
    table.text('wallet_id').notNullable()
    table.integer('note_index').notNullable()
    table.primary(['wallet_id', 'note_index'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shielded_spent_notes')
}
