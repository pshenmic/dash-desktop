import type {Knex} from 'knex'
import type {AppliedBlock, WalletSyncUtxo} from '../../p2p/types/walletSync'

// Re-exported so callers (services, future API handlers) can stay decoupled
// from the p2p IPC types if/when the protocol drifts.
export type {AppliedBlock, WalletSyncUtxo}

export class TransactionDAO {
  constructor(private readonly knex: Knex) {}

  // Atomic per-block write: tx + outputs + inputs + spend back-edges +
  // cursor advance, all in one SQL transaction. Cursor uses MAX semantics
  // so out-of-order block application (tip-follow racing the scan) can't
  // regress the resume marker.
  applyBlock = async (block: AppliedBlock): Promise<void> => {
    if (block.txs.length === 0 && block.spends.length === 0) {
      // Cursor-only advance; still useful when the scan tip moves past a
      // run of unmatched blocks.
      await this.advanceCursor(block.walletId, block.height)
      return
    }
    await this.knex.transaction(async trx => {
      const txRows = block.txs.map(t => ({
        wallet_id: block.walletId,
        txid: t.txid,
        block_height: block.height,
        block_hash: block.blockHash,
        block_time: block.blockTime,
        raw: Buffer.from(t.raw.buffer, t.raw.byteOffset, t.raw.byteLength),
      }))
      if (txRows.length > 0) {
        await trx('transactions').insert(txRows).onConflict(['wallet_id', 'txid']).ignore()
      }

      const outputRows = block.txs.flatMap(t =>
        t.outputs.map(o => ({
          wallet_id: block.walletId,
          txid: t.txid,
          vout: o.vout,
          address: o.address,
          satoshis: o.satoshis,
          is_mine: o.isMine,
        }))
      )
      if (outputRows.length > 0) {
        await trx('transaction_outputs')
          .insert(outputRows)
          .onConflict(['wallet_id', 'txid', 'vout'])
          .ignore()
      }

      const inputRows = block.txs.flatMap(t =>
        t.inputs.map(i => ({
          wallet_id: block.walletId,
          txid: t.txid,
          vin: i.vin,
          prev_txid: i.prevTxid,
          prev_vout: i.prevVout,
          sequence: i.sequence,
        }))
      )
      if (inputRows.length > 0) {
        await trx('transaction_inputs')
          .insert(inputRows)
          .onConflict(['wallet_id', 'txid', 'vin'])
          .ignore()
      }

      // Collect addresses to mark used. Receive side: outputs paying our
      // watched addresses. Send side: previous outputs being spent here —
      // SELECT each one's address right before flipping spent_in_txid so
      // we don't have to re-issue the lookup.
      const usedAddresses = new Set<string>()
      for (const tx of block.txs) {
        for (const o of tx.outputs) {
          if (o.isMine && o.address) usedAddresses.add(o.address)
        }
      }
      for (const s of block.spends) {
        const row = await trx('transaction_outputs')
          .select('address')
          .where({wallet_id: block.walletId, txid: s.prevTxid, vout: s.prevVout})
          .first()
        if (row?.address) usedAddresses.add(row.address as string)
        await trx('transaction_outputs')
          .where({wallet_id: block.walletId, txid: s.prevTxid, vout: s.prevVout})
          .update({spent_in_txid: s.spentInTxid, spent_at_height: block.height})
      }
      if (usedAddresses.size > 0) {
        const updated = await trx('addresses')
          .where('wallet_id', block.walletId)
          .whereIn('address', [...usedAddresses])
          .andWhere('is_used', false)
          .update({is_used: true})
        console.log(`[walletSync] marked ${updated} address(es) used at h=${block.height} (${usedAddresses.size} candidate(s))`)
      }

      await trx('wallet_sync_state')
        .insert({wallet_id: block.walletId, cfilter_cursor_height: block.height})
        .onConflict('wallet_id')
        .merge({
          cfilter_cursor_height: trx.raw(
            'MAX(wallet_sync_state.cfilter_cursor_height, excluded.cfilter_cursor_height)'
          ),
        })
    })
  }

  // Standalone cursor advance (MAX semantics). Used at cfilter scan
  // completion when the scan tip moves past blocks that produced no matches.
  advanceCursor = async (walletId: string, height: number): Promise<void> => {
    await this.knex('wallet_sync_state')
      .insert({wallet_id: walletId, cfilter_cursor_height: height})
      .onConflict('wallet_id')
      .merge({
        cfilter_cursor_height: this.knex.raw(
          'MAX(wallet_sync_state.cfilter_cursor_height, excluded.cfilter_cursor_height)'
        ),
      })
  }

  // Force-set the cursor (no MAX). Used by the rewind path when new
  // addresses are added to a wallet — we need to drop the cursor to a
  // lower height so historical filters get re-matched against the new
  // addresses.
  resetCursor = async (walletId: string, height: number): Promise<void> => {
    await this.knex('wallet_sync_state')
      .insert({wallet_id: walletId, cfilter_cursor_height: height})
      .onConflict('wallet_id')
      .merge({cfilter_cursor_height: height})
  }

  getCursor = async (walletId: string): Promise<number | null> => {
    const row = await this.knex('wallet_sync_state')
      .select('cfilter_cursor_height')
      .where({wallet_id: walletId})
      .first()
    return row ? row.cfilter_cursor_height : null
  }

  // Unspent outputs that pay the wallet. Same shape as WalletSyncUtxo so
  // both the renderer (via getUtxos IPC) and the cfilter worker (as
  // spend-detection seed in the start command) consume it directly.
  getUtxos = async (walletId: string): Promise<WalletSyncUtxo[]> => {
    const rows = await this.knex('transaction_outputs as o')
      .innerJoin('transactions as t', function() {
        this.on('t.wallet_id', '=', 'o.wallet_id').andOn('t.txid', '=', 'o.txid')
      })
      .select('o.txid', 'o.vout', 'o.address', 'o.satoshis', 't.block_height as height')
      .where('o.wallet_id', walletId)
      .andWhere('o.is_mine', true)
      .whereNull('o.spent_in_txid')
    return rows.map(r => ({
      txid: r.txid,
      vout: r.vout,
      address: r.address as string,
      satoshis: r.satoshis,
      height: r.height,
    }))
  }
}