import type { Knex } from 'knex'
import { Identity } from '../types/Identity'

function identityFromRow ({ wallet_id, identity_index, identifier, derivation_path, asset_lock_txid }): Identity {
  return { walletId: wallet_id, identityIndex: identity_index, identifier, derivationPath: derivation_path, assetLockTxid: asset_lock_txid ?? null }
}

export class IdentityDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  insertIdentities = async (identities: Identity[]): Promise<void> => {
    await this.knex('identities').insert(
      identities.map(e => ({
        wallet_id: e.walletId,
        identity_index: e.identityIndex,
        derivation_path: e.derivationPath,
        identifier: e.identifier,
      }))
    )
  }

  getIdentitiesByWalletId = async (walletId: string): Promise<Identity[]> => {
    const rows = await this.knex('identities')
      .select('wallet_id', 'identity_index', 'identifier', 'derivation_path', 'asset_lock_txid')
      .where('wallet_id', walletId)
      .orderBy('identity_index', 'asc')

    return rows.map(identityFromRow)
  }

  getByIdentifier = async (walletId: string, identifier: string): Promise<Identity | null> => {
    const row = await this.knex('identities')
      .select('wallet_id', 'identity_index', 'identifier', 'derivation_path', 'asset_lock_txid')
      .where({ wallet_id: walletId, identifier })
      .first()

    return row ? identityFromRow(row) : null
  }

  insertIdentity = async (identity: Identity, assetLockTxid: string | null): Promise<void> => {
    await this.knex('identities').insert({
      wallet_id: identity.walletId,
      identity_index: identity.identityIndex,
      derivation_path: identity.derivationPath,
      identifier: identity.identifier,
      asset_lock_txid: assetLockTxid,
    })
  }

  removeIdentity = async (walletId: string, identifier: string): Promise<void> => {
    await this.knex('identities').where({ wallet_id: walletId, identifier }).delete()
  }
}
