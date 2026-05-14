import type {Knex} from 'knex'

// Address usage flag. Set to true the first time a tx touches an address
// (either receives to it or spends from it). Drives BIP-32 gap-limit
// derivation: when used addresses approach the end of the derived range,
// derive more.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('addresses', table => {
    table.boolean('is_used').notNullable().defaultTo(false)
    table.index(['wallet_id', 'is_used'], 'address_wallet_used_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('addresses', table => {
    table.dropIndex(['wallet_id', 'is_used'], 'address_wallet_used_idx')
    table.dropColumn('is_used')
  })
}