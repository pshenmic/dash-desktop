import type {Knex} from 'knex'

// DPNS names this wallet registered or is registering for its identities.
// `pending` is written locally and never derived from the chain: until the
// domain document or the contest appears, a sent preorder looks like `missing`.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('aliases', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('identifier').notNullable()
    table.text('label').notNullable()
    table.text('normalized_label').notNullable()
    table.boolean('is_contested').notNullable()
    table.text('status').notNullable()
      .checkIn(['pending', 'registered', 'voting', 'locked', 'taken', 'missing'])
    table.text('document_id')
    // Kept so a domain that failed after its preorder is retried against that
    // preorder rather than paying for another.
    table.binary('preorder_salt')
    // Set only while or after a contest runs; null for an uncontested name.
    table.integer('votes_for')
    table.integer('votes_lock')
    table.integer('votes_abstain')
    // Milliseconds, as Date reports them: when a running vote is due to end,
    // then the block time it actually ended at.
    table.integer('vote_ends_at')
    table.integer('created_at').notNullable()
    table.integer('checked_at')
    table.primary(['wallet_id', 'identifier', 'normalized_label'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('aliases')
}
