import type {Knex} from 'knex'
import type {AppliedBlock, WalletSyncUtxo} from '../../p2p/types/walletSync'
import type {Transaction, TransactionInput, TransactionOutput} from '../types/Transaction'

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

    return rows.map(row => ({
      txid: row.txid,
      vout: row.vout,
      address: row.address as string,
      satoshis: row.satoshis,
      height: row.height,
    }))
  }

  resetSyncDataByNetwork = async (network: 'mainnet' | 'testnet'): Promise<void> => {
    await this.knex.transaction(async trx => {
      const walletIds = trx('wallet').select('wallet_id').where('network', network)
      await trx('transaction_inputs').whereIn('wallet_id', walletIds).delete()
      await trx('transaction_outputs').whereIn('wallet_id', walletIds).delete()
      await trx('transactions').whereIn('wallet_id', walletIds).delete()
      await trx('wallet_sync_state').whereIn('wallet_id', walletIds).delete()
      await trx('addresses').whereIn('wallet_id', walletIds).update({is_used: false})
    })
  }
  getUtxosByAddress = async (walletId: string, address: string): Promise<WalletSyncUtxo[]> => {
    const rows = await this.knex('transaction_outputs as o')
      .innerJoin('transactions as t', function() {
        this.on('t.wallet_id', '=', 'o.wallet_id').andOn('t.txid', '=', 'o.txid')
      })
      .select('o.txid', 'o.vout', 'o.address', 'o.satoshis', 't.block_height as height')
      .where('o.wallet_id', walletId)
      .andWhere('o.address', address)
      .whereNull('o.spent_in_txid')

    return rows.map(row => ({
      txid: row.txid,
      vout: row.vout,
      address: row.address as string,
      satoshis: row.satoshis,
      height: row.height,
    }))
  }

  getBalanceForAddresses = async (walletId: string, addresses: string[]): Promise<bigint> => {
    if (addresses.length === 0) return 0n

    const rows = await this.knex('transaction_outputs')
      .select('satoshis')
      .where('wallet_id', walletId)
      .whereIn('address', addresses)
      .whereNull('spent_in_txid')

    return rows.reduce((sum: bigint, row: {satoshis: string}) => sum + BigInt(row.satoshis), 0n)
  }

  // Single SQL query: every (tx × output × input × prev-output) row for
  // txs that touch `address` (received or spent from). Pivots in JS to
  // one Transaction per txid before returning.
  getTransactionsByAddress = async (walletId: string, address: string): Promise<Transaction[]> => {
    const txidsForAddress = this.knex('transaction_outputs')
      .select('txid')
      .where({wallet_id: walletId, address})
      .union(builder => builder
        .select('spent_in_txid as txid')
        .from('transaction_outputs')
        .where({wallet_id: walletId, address})
        .whereNotNull('spent_in_txid'))

    const rows = await this.knex('transactions as t')
      .leftJoin('transaction_outputs as o', function() {
        this.on('o.wallet_id', '=', 't.wallet_id').andOn('o.txid', '=', 't.txid')
      })
      .leftJoin('transaction_inputs as i', function() {
        this.on('i.wallet_id', '=', 't.wallet_id').andOn('i.txid', '=', 't.txid')
      })
      .leftJoin('transaction_outputs as prev', function() {
        this.on('prev.wallet_id', '=', 't.wallet_id')
          .andOn('prev.txid', '=', 'i.prev_txid')
          .andOn('prev.vout', '=', 'i.prev_vout')
      })
      .select(
        't.txid as t_txid',
        't.block_height as t_block_height',
        't.block_time as t_block_time',
        this.knex.raw('length(t.raw) as t_size'),
        'o.vout as o_vout',
        'o.address as o_address',
        'o.satoshis as o_satoshis',
        'o.is_mine as o_is_mine',
        'o.spent_in_txid as o_spent_in_txid',
        'o.spent_at_height as o_spent_at_height',
        'i.vin as i_vin',
        'i.prev_txid as i_prev_txid',
        'i.prev_vout as i_prev_vout',
        'i.sequence as i_sequence',
        'prev.address as i_prev_address',
        'prev.satoshis as i_prev_satoshis',
        'prev.is_mine as i_prev_is_mine',
      )
      .where('t.wallet_id', walletId)
      .whereIn('t.txid', txidsForAddress)
      .orderBy(['t.txid', 'o.vout', 'i.vin'])

    return shapeRowsToTransactions(rows, walletId)
  }

  // Same JOIN as above, scoped to one txid. Returns undefined if the tx
  // isn't recorded for this wallet.
  getTransactionByTxid = async (walletId: string, txid: string): Promise<Transaction | undefined> => {
    const rows = await this.knex('transactions as t')
      .leftJoin('transaction_outputs as o', function() {
        this.on('o.wallet_id', '=', 't.wallet_id').andOn('o.txid', '=', 't.txid')
      })
      .leftJoin('transaction_inputs as i', function() {
        this.on('i.wallet_id', '=', 't.wallet_id').andOn('i.txid', '=', 't.txid')
      })
      .leftJoin('transaction_outputs as prev', function() {
        this.on('prev.wallet_id', '=', 't.wallet_id')
          .andOn('prev.txid', '=', 'i.prev_txid')
          .andOn('prev.vout', '=', 'i.prev_vout')
      })
      .select(
        't.txid as t_txid',
        't.block_height as t_block_height',
        't.block_time as t_block_time',
        this.knex.raw('length(t.raw) as t_size'),
        'o.vout as o_vout',
        'o.address as o_address',
        'o.satoshis as o_satoshis',
        'o.is_mine as o_is_mine',
        'o.spent_in_txid as o_spent_in_txid',
        'o.spent_at_height as o_spent_at_height',
        'i.vin as i_vin',
        'i.prev_txid as i_prev_txid',
        'i.prev_vout as i_prev_vout',
        'i.sequence as i_sequence',
        'prev.address as i_prev_address',
        'prev.satoshis as i_prev_satoshis',
        'prev.is_mine as i_prev_is_mine',
      )
      .where('t.wallet_id', walletId)
      .andWhere('t.txid', txid)
      .orderBy(['o.vout', 'i.vin'])

    return shapeRowsToTransactions(rows, walletId)[0]
  }
}

// Pivot the cartesian-product join rows (one per output × input combo
// within each tx) into one Transaction per txid. Determines wallet-side
// direction/amounts/primary address using the is_mine column on each
// output (and on the prev output for inputs).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeRowsToTransactions(rows: any[], walletId: string): Transaction[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byTxid = new Map<string, {blockHeight: number; blockTime: number; size: number; outputs: Map<number, any>; inputs: Map<number, any>}>()

  for (const row of rows) {
    let acc = byTxid.get(row.t_txid)
    if (!acc) {
      acc = {
        blockHeight: row.t_block_height,
        blockTime: row.t_block_time,
        size: row.t_size,
        outputs: new Map(),
        inputs: new Map(),
      }
      byTxid.set(row.t_txid, acc)
    }
    if (row.o_vout != null && !acc.outputs.has(row.o_vout)) acc.outputs.set(row.o_vout, row)
    if (row.i_vin != null && !acc.inputs.has(row.i_vin)) acc.inputs.set(row.i_vin, row)
  }

  const out: Transaction[] = []
  for (const [txid, acc] of byTxid) {
    const inputRows = [...acc.inputs.values()].sort((a, b) => a.i_vin - b.i_vin)
    const outputRows = [...acc.outputs.values()].sort((a, b) => a.o_vout - b.o_vout)

    const ourInputsTotal: bigint = inputRows
      .filter(r => r.i_prev_is_mine === 1)
      .reduce((sum: bigint, r) => sum + BigInt(r.i_prev_satoshis ?? '0'), 0n)
    const ourOutputsTotal: bigint = outputRows
      .filter(r => r.o_is_mine === 1)
      .reduce((sum: bigint, r) => sum + BigInt(r.o_satoshis ?? '0'), 0n)

    const direction = ourInputsTotal > ourOutputsTotal ? -1 : 1
    const transferAmount = direction === -1
      ? ourInputsTotal - ourOutputsTotal
      : ourOutputsTotal - ourInputsTotal

    let primaryAddress = ''
    if (direction === -1) {
      primaryAddress = inputRows.find(r => r.i_prev_is_mine === 1)?.i_prev_address ?? ''
    } else {
      primaryAddress = outputRows.find(r => r.o_is_mine === 1)?.o_address ?? ''
    }

    const vin: TransactionInput[] = inputRows.map(r => ({
      value: ((Number(r.i_prev_satoshis ?? '0')) / 1e8).toFixed(8),
      n: r.i_vin ?? 0,
      addr: r.i_prev_address ?? '',
      prevTxId: r.i_prev_txid ?? '',
      prevVout: r.i_prev_vout ?? 0,
      sequence: r.i_sequence ?? 0,
    }))

    const vout: TransactionOutput[] = outputRows.map(r => ({
      value: ((Number(r.o_satoshis ?? '0')) / 1e8).toFixed(8),
      n: r.o_vout ?? 0,
      address: r.o_address ?? '',
      spentTxId: r.o_spent_in_txid ?? '',
      spentIndex: 0,
      spentHeight: r.o_spent_at_height ?? 0,
    }))

    out.push({
      address: primaryAddress,
      direction,
      inAmount: ourInputsTotal,
      outAmount: ourOutputsTotal,
      transferAmount,
      usdAmount: '0.0',
      date: new Date(acc.blockTime * 1000),
      size: acc.size,
      blockHeight: acc.blockHeight,
      status: 'Pending',
      walletId,
      confirmations: 0,
      txid,
      vin,
      vout,
    })
  }

  return out
}