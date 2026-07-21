import type {Knex} from 'knex'

// Address book. One row per saved contact, scoped to a network so the same
// label/address pair can exist independently on testnet and mainnet. The
// unique (address, network) constraint prevents duplicate entries.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('contacts', table => {
    table.increments('id').primary()
    table.text('label').notNullable()
    table.text('address').notNullable()
    table.text('network').notNullable().checkIn(['testnet', 'mainnet'])
    table.integer('created_at').notNullable().defaultTo(0)

    table.index('network', 'contacts_network_idx')
    table.unique(['address', 'network'], { useConstraint: true })
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('contacts')
}
