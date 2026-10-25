import type {Knex} from 'knex'
import {MasternodeKeys} from '../types/Masternode'

export class MasternodeKeyDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getKeys = async (walletId: string): Promise<MasternodeKeys | null> => {
    const [row, platformRows] = await this.knex.transaction(async trx => Promise.all([
      trx('masternode_keys')
        .select('voting_xpub', 'owner_xpub', 'operator_public_key', 'operator_chain_code')
        .where('wallet_id', walletId)
        .first(),
      trx('masternode_platform_keys')
        .select('public_key')
        .where('wallet_id', walletId)
        .orderBy('key_index', 'asc'),
    ]))
    if (row == null) return null

    return {
      votingXpub: row.voting_xpub,
      ownerXpub: row.owner_xpub,
      operatorPublicKey: row.operator_public_key,
      operatorChainCode: row.operator_chain_code,
      platformNodeKeys: platformRows.map(({public_key}) => public_key),
    }
  }

  hasKeys = async (walletId: string): Promise<boolean> => {
    return await this.knex('masternode_keys').where('wallet_id', walletId).first('wallet_id') != null
  }

  // Ignores a conflict: two concurrent backfills derive the same keys, and the
  // loser must not fail the password check that triggered it.
  saveKeys = async (walletId: string, keys: MasternodeKeys): Promise<void> => {
    await this.knex.transaction(async trx => {
      await trx('masternode_keys')
        .insert({
          wallet_id: walletId,
          voting_xpub: keys.votingXpub,
          owner_xpub: keys.ownerXpub,
          operator_public_key: Buffer.from(keys.operatorPublicKey),
          operator_chain_code: Buffer.from(keys.operatorChainCode),
        })
        .onConflict('wallet_id')
        .ignore()
      await trx('masternode_platform_keys')
        .insert(keys.platformNodeKeys.map((publicKey, keyIndex) => ({
          wallet_id: walletId,
          key_index: keyIndex,
          public_key: Buffer.from(publicKey),
        })))
        .onConflict(['wallet_id', 'key_index'])
        .ignore()
    })
  }
}
