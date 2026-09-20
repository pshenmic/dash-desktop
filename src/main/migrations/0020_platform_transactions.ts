import type {Knex} from 'knex'

// Explorer-sourced L2 history, kept so a history read stops re-walking every
// page of every address and identity on each call.
//
// One row per (transition, the walk that reported it), not per transition: a
// transition moving credits between an address and an identity of ours is
// listed by both walks, each counting only its own side. Folding them before
// the write would make re-reading a page count it twice, so the sides are
// stored apart and folded on the way out.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('platform_transactions', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('hash').notNullable()
    // Which walk: an identity identifier, or PLATFORM_EXPLORER_ADDRESS_SOURCE
    // for the address set, whose rows the explorer has already aggregated.
    table.text('source').notNullable()
    table.text('type').notNullable()
    // Milliseconds, as Date reports them.
    table.integer('timestamp').notNullable()
    // Both null on a row from an identity transfer, which reports neither.
    table.integer('block_height')
    table.text('status').checkIn(['SUCCESS', 'FAIL'])
    table.text('error')
    table.text('gas_credits').notNullable()
    // TEXT like satoshis, and signed: the driver reads an INTEGER column back
    // as a JS number, and credits pass 2^53 well inside the supply.
    table.text('net_credits').notNullable()
    // Each end of the transition, so a move between two of ours keeps both:
    // which side is ours is the sign of net_credits, not a column.
    table.text('sender')
    table.text('recipient')
    table.primary(['wallet_id', 'hash', 'source'])
    table.index(['wallet_id', 'timestamp'], 'platform_tx_time_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('platform_transactions')
}
