import type {Knex} from 'knex'
import type {Identity} from '../types/Identity'

export interface ImportedIdentityKey {
  walletId: string
  identityIdentifier: string
  keyId: number
  publicKeyHash: string
  encryptedPrivateKey: string
}

function keyFromRow({wallet_id, identity_identifier, key_id, public_key_hash, encrypted_private_key}): ImportedIdentityKey {
  return {
    walletId: wallet_id,
    identityIdentifier: identity_identifier,
    keyId: key_id,
    publicKeyHash: public_key_hash,
    encryptedPrivateKey: encrypted_private_key,
  }
}

export class IdentityKeyDAO {
  constructor(private readonly knex: Knex) {}

  async getByIdentity(walletId: string, identityIdentifier: string): Promise<ImportedIdentityKey[]> {
    const rows = await this.knex('identity_keys')
      .select('wallet_id', 'identity_identifier', 'key_id', 'public_key_hash', 'encrypted_private_key')
      .where({wallet_id: walletId, identity_identifier: identityIdentifier})
      .orderBy('key_id', 'asc')

    return rows.map(keyFromRow)
  }

  async insertImportedIdentity(identity: Identity, keys: ImportedIdentityKey[]): Promise<void> {
    await this.knex.transaction(async trx => {
      await trx('identities').insert({
        wallet_id: identity.walletId,
        identity_index: identity.identityIndex,
        derivation_path: identity.derivationPath,
        identifier: identity.identifier,
        asset_lock_txid: null,
        is_imported: true,
      })

      await trx('identity_keys').insert(keys.map(key => ({
        wallet_id: key.walletId,
        identity_identifier: key.identityIdentifier,
        key_id: key.keyId,
        public_key_hash: key.publicKeyHash,
        encrypted_private_key: key.encryptedPrivateKey,
      })))
    })
  }
}
