import type {Knex} from 'knex'

// Raw ciphertext of each pool note, added to `shielded_notes`:
//   nullifier / cmx / encrypted_note / cv_net   fields returned by
//   getShieldedEncryptedNotes (nullable until the payload is fetched)
//
// Lets the background poller download each note once, without the password,
// and the wallet trial-decrypt undecoded notes locally on unlock instead of
// re-downloading the pool on every sync.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shielded_notes', table => {
    table.binary('nullifier').nullable()
    table.binary('cmx').nullable()
    table.binary('encrypted_note').nullable()
    table.binary('cv_net').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shielded_notes', table => {
    table.dropColumn('nullifier')
    table.dropColumn('cmx')
    table.dropColumn('encrypted_note')
    table.dropColumn('cv_net')
  })
}
