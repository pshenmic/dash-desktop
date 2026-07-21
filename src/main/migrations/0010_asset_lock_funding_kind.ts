import type {Knex} from 'knex'

// Add a discriminator for what an asset-lock funding pays for
// (address / shielded / identity / identityTopUp). Existing rows predate the
// other kinds, so they default to 'address'.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset_lock_fundings', table => {
    table.text('kind').notNullable().defaultTo('address')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset_lock_fundings', table => {
    table.dropColumn('kind')
  })
}
