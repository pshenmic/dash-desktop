import type {Knex} from 'knex'

// A note's nullifier is derived from the seed, so only a sync can compute it.
// Persisting it lets a locked wallet ask the chain whether its notes are still
// spendable — decoding a note needs the seed, checking one does not.
//
// Nullable: rows written before this ran have none until the next sync.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shielded_notes', table => {
    table.binary('nullifier').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shielded_notes', table => {
    table.dropColumn('nullifier')
  })
}
