import type {Knex} from 'knex'

// Wallet-scoped transaction storage; all four tables are SQLCipher-eligible,
// since they identify the wallet and reveal balances.
//
// `transactions` holds every on-chain tx touching the wallet on either side,
// with outputs and inputs mirrored verbatim so a future tx-info API can serve
// one without going back to peers. UTXOs are derived, not stored: outputs
// WHERE is_mine AND spent_in_txid IS NULL.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transactions', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('txid').notNullable()
    table.integer('block_height').notNullable()
    table.text('block_hash').notNullable()
    table.integer('block_time').notNullable()
    table.binary('raw').notNullable()
    table.primary(['wallet_id', 'txid'])
    table.index(['wallet_id', 'block_height'], 'tx_wallet_height_idx')
  })

  await knex.schema.createTable('transaction_outputs', table => {
    table.text('wallet_id').notNullable()
    table.text('txid').notNullable()
    table.integer('vout').notNullable()
    table.text('address')
    table.text('satoshis').notNullable()
    table.boolean('is_mine').notNullable().defaultTo(false)
    table.text('spent_in_txid')
    table.integer('spent_at_height')
    table.primary(['wallet_id', 'txid', 'vout'])
    // Hot path: UTXO query. Filtered by wallet, mine, and unspent.
    table.index(['wallet_id', 'is_mine', 'spent_in_txid'], 'txout_utxo_idx')
    // Address-scoped queries (history per address, future explorer view).
    table.index(['wallet_id', 'address'], 'txout_address_idx')
  })

  await knex.schema.createTable('transaction_inputs', table => {
    table.text('wallet_id').notNullable()
    table.text('txid').notNullable()
    table.integer('vin').notNullable()
    table.text('prev_txid').notNullable()
    table.integer('prev_vout').notNullable()
    table.integer('sequence').notNullable()
    table.primary(['wallet_id', 'txid', 'vin'])
    // Reverse lookup: "which of our txs spent prev_txid:prev_vout?".
    table.index(['wallet_id', 'prev_txid', 'prev_vout'], 'txin_prev_idx')
  })

  // 1:1 with wallet, kept separate so the cursor's per-block writes don't churn
  // the otherwise-stable wallet row.
  await knex.schema.createTable('wallet_sync_state', table => {
    table.text('wallet_id').notNullable().primary().references('wallet_id').inTable('wallet')
    table.integer('cfilter_cursor_height').notNullable().defaultTo(0)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('wallet_sync_state')
  await knex.schema.dropTableIfExists('transaction_inputs')
  await knex.schema.dropTableIfExists('transaction_outputs')
  await knex.schema.dropTableIfExists('transactions')
}