import type {Knex} from 'knex'

// The DAPI urls of the last verified masternode list, so the platform SDK has
// nodes to probe at launch before p2p has fetched a fresh list.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('evonodes', table => {
    table.text('network').notNullable().checkIn(['mainnet', 'testnet'])
    table.text('url').notNullable()
    table.primary(['network', 'url'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('evonodes')
}
