import {Knex} from 'knex'
import {AssetLockFundingStatus} from '../enums/AssetLockFundingStatus'
import {AssetLockProofParams} from '../../platform/types/messages'

import {AssetLockFundingKind, AssetLockFundingRow} from '../types/AssetLock'
// Written by us as JSON, but a hand-edited or truncated row must not wedge every
// later resume — an unreadable proof just means waiting for the lock again.
function parseProof(value: unknown): AssetLockProofParams | null {
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    return JSON.parse(value) as AssetLockProofParams
  } catch {
    return null
  }
}

function fromRow(row: Record<string, unknown>): AssetLockFundingRow {
  return {
    id: row.id as number,
    walletId: row.wallet_id as string,
    txid: row.txid as string,
    outputIndex: row.output_index as number,
    creditDerivationPath: row.credit_derivation_path as string,
    amountDuffs: BigInt(row.amount_duffs as string),
    toPlatformAddress: row.to_platform_address as string,
    kind: (row.kind as AssetLockFundingKind | null) ?? 'address',
    status: row.status as AssetLockFundingStatus,
    stHash: (row.st_hash as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    identityIndex: (row.identity_index as number | null) ?? null,
    txHex: (row.tx_hex as string | null) ?? null,
    assetLockProof: parseProof(row.asset_lock_proof),
    createdAt: row.created_at as number,
  }
}

export class AssetLockDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  insertFunding = async (funding: Omit<AssetLockFundingRow, 'id' | 'stHash' | 'error' | 'assetLockProof'>): Promise<void> => {
    await this.knex('asset_lock_fundings').insert({
      wallet_id: funding.walletId,
      txid: funding.txid,
      output_index: funding.outputIndex,
      credit_derivation_path: funding.creditDerivationPath,
      amount_duffs: funding.amountDuffs.toString(),
      to_platform_address: funding.toPlatformAddress,
      kind: funding.kind,
      status: funding.status,
      identity_index: funding.identityIndex,
      tx_hex: funding.txHex,
      created_at: funding.createdAt,
    })
  }

  // txid is unique table-wide, so wallet_id cannot narrow this today. It keeps
  // the write scoped if that index is ever relaxed.
  updateStatus = async (walletId: string, txid: string, status: AssetLockFundingStatus, fields?: {stHash?: string; error?: string}): Promise<void> => {
    await this.knex('asset_lock_fundings').where({wallet_id: walletId, txid}).update({
      status,
      ...(fields?.stHash != null ? {st_hash: fields.stHash} : {}),
      error: fields?.error ?? null,
    })
  }

  saveProof = async (walletId: string, txid: string, proof: AssetLockProofParams): Promise<void> => {
    await this.knex('asset_lock_fundings')
      .where({wallet_id: walletId, txid})
      .update({asset_lock_proof: JSON.stringify(proof)})
  }

  countFundingsByKind = async (walletId: string, kind: AssetLockFundingKind): Promise<number> => {
    const row = await this.knex('asset_lock_fundings')
      .where({wallet_id: walletId, kind})
      .count({count: '*'})
      .first()
    return Number(row?.count ?? 0)
  }

  getActiveFunding = async (walletId: string): Promise<AssetLockFundingRow | null> => {
    const row = await this.knex('asset_lock_fundings')
      .where({wallet_id: walletId})
      .whereIn('status', [AssetLockFundingStatus.L1Broadcast, AssetLockFundingStatus.ChainLocked, AssetLockFundingStatus.StBroadcast])
      .orderBy('id', 'desc')
      .first()
    return row ? fromRow(row) : null
  }
}
