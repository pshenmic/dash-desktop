import type {Knex} from 'knex'

// asset_lock_proof stores the resolved instant/chain lock proof as JSON once the
// lock is seen. A resume that already has it can broadcast the state transition
// straight away instead of racing the lock again — an islock our peers already
// delivered is not re-requestable, and a chain lock costs minutes of polling.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset_lock_fundings', table => {
    table.text('asset_lock_proof').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset_lock_fundings', table => {
    table.dropColumn('asset_lock_proof')
  })
}