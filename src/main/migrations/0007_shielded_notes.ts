import type {Knex} from 'knex'

// Per-wallet shielded (Orchard) note cache, one row per note index. `amount`
// and `address` stay null until a sync trial-decrypts the note; `is_mine`
// records that it decrypted to this wallet.
//
// Supersedes the spent-index-only `shielded_spent_notes`: the note set and its
// spendable balance now render without re-deriving from the seed (which needs
// the password) on every load, while still carrying the spent-set the prover
// needs on the next sync.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shielded_notes', table => {
    table.text('wallet_id').notNullable()
    table.integer('note_index').notNullable()
    table.text('amount').nullable()
    table.text('address').nullable()
    table.boolean('spent').nullable()
    table.boolean('is_mine').nullable()
    table.boolean('is_decoded').notNullable().defaultTo(false)
    table.primary(['wallet_id', 'note_index'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shielded_notes')
}
