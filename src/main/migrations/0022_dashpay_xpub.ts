import type {Knex} from 'knex'

// The public DashPay account key m/9'/coin'/15'/0': both identity-id levels below
// it are non-hardened, so every contact chain of ours derives from it without the seed.
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
