import type {Knex} from 'knex'

// The Orchard pool is network state, so it moves out from behind `wallet_id`:
// every wallet was storing a byte-identical copy of every note's ciphertext.
//
// Two columns disappear rather than move. `is_mine` was only ever written true,
// so a row's existence carries it. `is_decoded` was always set as a prefix
// (`markDecodedBelow`), so `wallet.shielded_decoded_count` carries it — which is
// what lets the wallet table drop from one row per pool note to one row per
// owned note.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shielded_pool_notes', table => {
    table.text('network').notNullable().checkIn(['testnet', 'mainnet'])
    table.integer('note_index').notNullable()
    table.binary('nullifier').notNullable()
    table.binary('cmx').notNullable()
    table.binary('encrypted_note').notNullable()
    table.binary('cv_net').notNullable()
    table.primary(['network', 'note_index'])
  })

  // `shielded_notes` never carried a network, so attribution comes from the
  // owning wallet; wallets on the same network collapse onto one row.
  await knex.raw(`
    INSERT OR IGNORE INTO shielded_pool_notes
      (network, note_index, nullifier, cmx, encrypted_note, cv_net)
    SELECT w.network, n.note_index, n.nullifier, n.cmx, n.encrypted_note, n.cv_net
      FROM shielded_notes n
      JOIN wallet w ON w.wallet_id = n.wallet_id
     WHERE n.encrypted_note IS NOT NULL
  `)

  await knex.schema.alterTable('wallet', table => {
    table.integer('shielded_decoded_count').notNullable().defaultTo(0)
  })

  await knex.raw(`
    UPDATE wallet SET shielded_decoded_count = COALESCE((
      SELECT MAX(n.note_index) + 1
        FROM shielded_notes n
       WHERE n.wallet_id = wallet.wallet_id AND n.is_decoded = 1
    ), 0)
  `)

  await knex.schema.createTable('shielded_owned_notes', table => {
    table.text('wallet_id').notNullable()
    table.integer('note_index').notNullable()
    table.text('amount').notNullable()
    table.text('address').notNullable()
    table.boolean('spent').notNullable().defaultTo(false)
    table.primary(['wallet_id', 'note_index'])
  })

  await knex.raw(`
    INSERT INTO shielded_owned_notes (wallet_id, note_index, amount, address, spent)
    SELECT wallet_id, note_index, amount, address, COALESCE(spent, 0)
      FROM shielded_notes
     WHERE is_mine = 1 AND amount IS NOT NULL AND address IS NOT NULL
  `)

  await knex.schema.dropTable('shielded_notes')
  await knex.schema.renameTable('shielded_owned_notes', 'shielded_notes')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.renameTable('shielded_notes', 'shielded_owned_notes')

  await knex.schema.createTable('shielded_notes', table => {
    table.text('wallet_id').notNullable()
    table.integer('note_index').notNullable()
    table.text('amount').nullable()
    table.text('address').nullable()
    table.boolean('spent').nullable()
    table.boolean('is_mine').nullable()
    table.boolean('is_decoded').notNullable().defaultTo(false)
    table.binary('nullifier').nullable()
    table.binary('cmx').nullable()
    table.binary('encrypted_note').nullable()
    table.binary('cv_net').nullable()
    table.primary(['wallet_id', 'note_index'])
  })

  // Re-fan the pool back out: one copy per wallet on that network.
  await knex.raw(`
    INSERT INTO shielded_notes
      (wallet_id, note_index, is_decoded, nullifier, cmx, encrypted_note, cv_net)
    SELECT w.wallet_id, p.note_index, p.note_index < w.shielded_decoded_count,
           p.nullifier, p.cmx, p.encrypted_note, p.cv_net
      FROM shielded_pool_notes p
      JOIN wallet w ON w.network = p.network
  `)

  await knex.raw(`
    INSERT INTO shielded_notes (wallet_id, note_index, amount, address, spent, is_mine, is_decoded)
    SELECT wallet_id, note_index, amount, address, spent, 1, 1
      FROM shielded_owned_notes
      WHERE true
    ON CONFLICT (wallet_id, note_index)
    DO UPDATE SET amount = excluded.amount, address = excluded.address,
                  spent = excluded.spent, is_mine = 1, is_decoded = 1
  `)

  await knex.schema.dropTable('shielded_owned_notes')
  await knex.schema.dropTable('shielded_pool_notes')
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('shielded_decoded_count')
  })
}