import type {Knex} from 'knex'

// Lets shielded addresses run the shared gap walk, which needs a per-address used
// flag. No derivation_path column: a diversifier is not a path element, so the
// path would be m/32'/coinType'/account' on every row — the account is already
// implied by the wallet and the diversifier is address_index.
//
// Existing rows are unused as far as anything knows; the first walk after a sync
// sets the flag from the decrypted notes.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shielded_addresses', table => {
    table.boolean('is_used').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shielded_addresses', table => {
    table.dropColumn('is_used')
  })
}
