import type {Knex} from 'knex'

// Per-wallet shielded (Orchard) note cache. One row per note index:
//   wallet_id   owning wallet
//   note_index  Orchard note position (derivation/commitment index)
//   amount      note value in credits (string; nullable until synced)
//   address     shielded destination address (nullable until synced)
//   spent       whether the note has been spent
//   is_mine     whether the note decrypts to this wallet (trial-decryption)
//
// Supersedes the spent-index-only `shielded_spent_notes` table: the wallet can
// now render the note set and its spendable balance without re-deriving from
// the seed (which needs the password) on every load, while still carrying the
// spent-set the prover needs on the next sync.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shielded_notes', table => {
    table.text('wallet_id').notNullable()
    table.integer('note_index').notNullable()
    table.text('amount').nullable()
    table.text('address').nullable()
    table.boolean('spent').notNullable().defaultTo(false)
    table.boolean('is_mine').notNullable().defaultTo(true)
    table.primary(['wallet_id', 'note_index'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shielded_notes')
}