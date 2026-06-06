import type {Knex} from 'knex'

// Locally-broadcast transactions are recorded optimistically — before any
// block confirms them — so the wallet stops offering their spent inputs and
// can spend their change immediately. Such rows carry block_height = 0 (the
// "unconfirmed" sentinel; genesis is height 1, so 0 is never a real block)
// until the cfilter scan applies the block that includes them.
//
//   instant_locked  set when a DIP-24 isdlock for the tx is observed.
//   chainlocked     set when a ChainLock (clsig) covers the tx's block.
//   first_seen_at    ms timestamp of first local broadcast — drives the
//                   rebroadcast cadence and stale-release heuristics.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transactions', table => {
    table.boolean('instant_locked').notNullable().defaultTo(false)
    table.boolean('chainlocked').notNullable().defaultTo(false)
    table.integer('first_seen_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transactions', table => {
    table.dropColumn('instant_locked')
    table.dropColumn('chainlocked')
    table.dropColumn('first_seen_at')
  })
}
