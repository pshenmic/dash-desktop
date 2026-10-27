import type {Knex} from 'knex'

// The DashPay account key m/9'/coin'/15'/0', public. Both identity-id levels
// below it are non-hardened, so every contact chain of ours derives from it
// without the seed. Everything else DashPay and DPNS is fetched from the network.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.text('dashpay_xpub').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('dashpay_xpub')
  })
}
