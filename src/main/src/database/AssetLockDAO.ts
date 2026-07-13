import {Knex} from 'knex'

export type AssetLockFundingStatus = 'l1_broadcast' | 'chainlocked' | 'st_broadcast' | 'done' | 'error'
export type AssetLockFundingKind = 'address' | 'shielded'

export interface AssetLockFundingRow {
  id: number
  walletId: string
  txid: string
  outputIndex: number
  creditDerivationPath: string
  amountDuffs: string
  toPlatformAddress: string
  kind: AssetLockFundingKind
  status: AssetLockFundingStatus
  stHash: string | null
  error: string | null
  createdAt: number
}

function fromRow(row: Record<string, unknown>): AssetLockFundingRow {
  return {
    id: row.id as number,
    walletId: row.wallet_id as string,
    txid: row.txid as string,
    outputIndex: row.output_index as number,
    creditDerivationPath: row.credit_derivation_path as string,
    amountDuffs: row.amount_duffs as string,
    toPlatformAddress: row.to_platform_address as string,
    kind: (row.kind as AssetLockFundingKind | null) ?? 'address',
    status: row.status as AssetLockFundingStatus,
    stHash: (row.st_hash as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as number,
  }
}

export class AssetLockDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  insertFunding = async (funding: Omit<AssetLockFundingRow, 'id' | 'stHash' | 'error'>): Promise<void> => {
    await this.knex('asset_lock_fundings').insert({
      wallet_id: funding.walletId,
      txid: funding.txid,
      output_index: funding.outputIndex,
      credit_derivation_path: funding.creditDerivationPath,
      amount_duffs: funding.amountDuffs,
      to_platform_address: funding.toPlatformAddress,
      kind: funding.kind,
      status: funding.status,
      created_at: funding.createdAt,
    })
  }

  updateStatus = async (txid: string, status: AssetLockFundingStatus, fields?: {stHash?: string; error?: string}): Promise<void> => {
    await this.knex('asset_lock_fundings').where({txid}).update({
      status,
      ...(fields?.stHash != null ? {st_hash: fields.stHash} : {}),
      ...(fields?.error != null ? {error: fields.error} : {}),
    })
  }

  getActiveFunding = async (walletId: string): Promise<AssetLockFundingRow | null> => {
    const row = await this.knex('asset_lock_fundings')
      .where({wallet_id: walletId})
      .whereIn('status', ['l1_broadcast', 'chainlocked', 'st_broadcast'])
      .orderBy('id', 'desc')
      .first()
    return row ? fromRow(row) : null
  }
}
