import type {Knex} from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('identities', table => {
    table.boolean('is_imported').notNullable().defaultTo(false)
  })

  await knex.schema.createTable('identity_keys', table => {
    table.increments('id').primary()
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('identity_identifier').notNullable()
    table.integer('key_id').notNullable()
    table.text('public_key_hash').notNullable()
    table.text('encrypted_private_key').notNullable()

    table.unique(['wallet_id', 'identity_identifier', 'key_id'])
    table.index(['wallet_id', 'identity_identifier'], 'identity_keys_wallet_identity_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('identity_keys')
  await knex.schema.alterTable('identities', table => {
    table.dropColumn('is_imported')
  })
}
