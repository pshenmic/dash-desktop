import type {Knex} from 'knex'

// DIP-3 provider account keys, public, so masternode keys derive without the
// seed. A wallet has a full row or none; one created before this table gets its
// row the next time the password is verified.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('masternode_keys', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('voting_xpub').notNullable()
    table.text('owner_xpub').notNullable()
    table.binary('operator_public_key').notNullable()
    table.binary('operator_chain_code').notNullable()
    table.primary(['wallet_id'])
  })

  // Ed25519 has no public derivation, so each platform node key is stored.
  await knex.schema.createTable('masternode_platform_keys', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.integer('key_index').notNullable()
    table.binary('public_key').notNullable()
    table.primary(['wallet_id', 'key_index'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('masternode_platform_keys')
  await knex.schema.dropTableIfExists('masternode_keys')
}
