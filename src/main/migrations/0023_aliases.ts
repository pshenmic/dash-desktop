import type {Knex} from 'knex'

// DPNS names this wallet registered or is registering for its identities.
// `pending` is written locally and never derived from the chain: until the
// domain document or the contest appears, a sent preorder looks like `missing`.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('aliases', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('identifier').notNullable()
    table.text('label').notNullable()
    table.text('normalized_label').notNullable()
    table.boolean('is_contested').notNullable()
    table.text('status').notNullable()
      .checkIn(['pending', 'registered', 'voting', 'locked', 'taken', 'missing'])
    table.text('document_id')
    // Kept so a domain that failed after its preorder is retried against that
    // preorder rather than paying for another.
    table.binary('preorder_salt')
    // Set only while or after a contest runs; null for an uncontested name.
    table.integer('votes_for')
    table.integer('votes_lock')
    table.integer('votes_abstain')
    // Milliseconds, as Date reports them: when a running vote is due to end,
    // then the block time it actually ended at.
    table.integer('vote_ends_at')
    table.integer('created_at').notNullable()
    table.integer('checked_at')
    table.primary(['wallet_id', 'identifier', 'normalized_label'])
  })

  // DashPay contactRequest documents sent or received by this wallet's
  // identities. A document between two of them is still one row.
  await knex.schema.createTable('dashpay_contact_requests', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('document_id').notNullable()
    table.text('owner_id').notNullable()
    table.text('to_user_id').notNullable()
    table.integer('sender_key_index').notNullable()
    table.integer('recipient_key_index').notNullable()
    table.integer('account_reference').notNullable()
    table.binary('encrypted_public_key').notNullable()
    // Platform's $createdAt, in milliseconds.
    table.integer('created_at').notNullable()
    // On a request sent to us: the sender's payment key, decrypted the first
    // time the seed was at hand. Public, it only derives addresses to pay them.
    table.text('contact_xpub')
    // Set when that key can never be decrypted; a new request is a new row.
    table.boolean('payment_channel_broken').notNullable().defaultTo(false)
    table.primary(['wallet_id', 'document_id'])
  })

  // The DashPay account key m/9'/coin'/15'/0', public. Both identity-id levels
  // below it are non-hardened, so every contact chain of ours derives from it
  // without the seed.
  await knex.schema.alterTable('wallet', table => {
    table.text('dashpay_xpub').nullable()
  })

  // Both DIP-15 chains of a friendship: `receiving` is ours, which the contact
  // pays; `external` is theirs, which we pay and never count as ours.
  await knex.schema.createTable('dashpay_contact_addresses', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('identifier').notNullable()
    table.text('contact_id').notNullable()
    table.text('direction').notNullable().checkIn(['receiving', 'external'])
    table.integer('address_index').notNullable()
    table.text('address').notNullable()
    table.boolean('is_used').notNullable().defaultTo(false)
    table.primary(['wallet_id', 'identifier', 'contact_id', 'direction', 'address_index'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dashpay_contact_addresses')
  await knex.schema.alterTable('wallet', table => {
    table.dropColumn('dashpay_xpub')
  })
  await knex.schema.dropTableIfExists('dashpay_contact_requests')
  await knex.schema.dropTableIfExists('aliases')
}
