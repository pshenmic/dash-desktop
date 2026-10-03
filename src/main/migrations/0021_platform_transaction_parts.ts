import type {Knex} from 'knex'
import {CREDITS_PER_DUFF} from '../src/constants/credits'
import {INSERT_CHUNK_SIZE} from '../src/constants/database'
import {chunk} from '../src/utils/chunk'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('platform_transaction_parts', table => {
    table.text('wallet_id').notNullable()
    table.text('hash').notNullable()
    table.text('parent_source').notNullable()
    table.text('side').notNullable().checkIn(['sender', 'recipient'])
    table.integer('entry_index').notNullable()
    table.text('part_source').notNullable()
    table.text('amount_credits').notNullable()
    table.primary(['wallet_id', 'hash', 'parent_source', 'side', 'entry_index'])
    table.foreign(['wallet_id', 'hash', 'parent_source'])
      .references(['wallet_id', 'hash', 'source'])
      .inTable('platform_transactions')
  })

  const [transactions, fundings] = await Promise.all([
    knex('platform_transactions').select('wallet_id', 'hash', 'source', 'net_credits', 'sender', 'recipient'),
    knex('asset_lock_fundings').select('wallet_id', 'st_hash', 'amount_duffs').whereNotNull('st_hash'),
  ])
  const locked = new Map(fundings.map(funding => [
    `${funding.wallet_id}:${(funding.st_hash as string).toLowerCase()}`,
    BigInt(funding.amount_duffs as string) * CREDITS_PER_DUFF,
  ]))
  const parts = transactions.flatMap(transaction => {
    const net = BigInt(transaction.net_credits as string)
    const amount = net === 0n
      ? locked.get(`${transaction.wallet_id}:${(transaction.hash as string).toLowerCase()}`) ?? 0n
      : net < 0n ? -net : net
    const row = {
      wallet_id: transaction.wallet_id,
      hash: transaction.hash,
      parent_source: transaction.source,
      entry_index: 0,
      amount_credits: amount.toString(),
    }

    return [
      ...(transaction.sender == null ? [] : [{...row, side: 'sender', part_source: transaction.sender}]),
      ...(transaction.recipient == null ? [] : [{...row, side: 'recipient', part_source: transaction.recipient}]),
    ]
  })

  for (const rows of chunk(parts, INSERT_CHUNK_SIZE)) {
    await knex('platform_transaction_parts').insert(rows)
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('platform_transaction_parts')
}
