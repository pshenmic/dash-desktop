import type {Knex} from 'knex'
import type {AppliedBlock, AppliedTx, WalletSyncUtxo} from '../../p2p/types/walletSync'
import type {AddressInfo} from '../types/AddressInfo'
import type {PrevOutRef, ResolvedPrevOut, Transaction, TransactionInput, TransactionOutput, UnresolvedInput} from '../types/Transaction'
import type {TxLockStatus} from '../types/TxLockStatus'
import type {Network} from '../types/Network'

import {PendingTx} from '../types/PendingTx'
import {COINBASE_PREV_TXID} from '../constants/chain'
import {SELECT_CHUNK_SIZE} from '../constants/database'
export class TransactionDAO {
  constructor(private readonly knex: Knex) {}

  // One SQL transaction for the whole block. The cursor uses MAX semantics so
  // out-of-order application (tip-follow racing the scan) cannot regress the
  // resume marker; advanceCursor:false holds it back entirely once an earlier
  // block failed to persist, so the scan re-covers the gap.
  applyBlock = async (block: AppliedBlock, opts: {advanceCursor?: boolean} = {}): Promise<void> => {
    const advanceCursor = opts.advanceCursor ?? true

    if (block.txs.length === 0 && block.spends.length === 0) {
      // Cursor-only advance; still useful when the scan tip moves past a
      // run of unmatched blocks.
      if (advanceCursor) await this.advanceCursor(block.walletId, block.height)
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
        // merge (not ignore) so a tx we recorded optimistically at broadcast
        // (block_height = 0) gets its real height/hash/time when its block is
        // finally scanned.
        await trx('transactions')
          .insert(txRows)
          .onConflict(['wallet_id', 'txid'])
          .merge(['block_height', 'block_hash', 'block_time', 'raw'])
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

      // The send-side address is read right before flipping spent_in_txid, to
      // avoid re-issuing the lookup afterwards.
      const usedAddresses = new Set<string>()
      for (const tx of block.txs) {
        for (const o of tx.outputs) {
          if (o.isMine && o.address) usedAddresses.add(o.address)
        }
      }
      // Outpoints whose optimistic (pre-confirmation) spender lost to a
      // different on-chain spender — those local txs can never confirm.
      const conflicted = new Set<string>()
      for (const s of block.spends) {
        const row = await trx('transaction_outputs')
          .select('address', 'spent_in_txid')
          .where({wallet_id: block.walletId, txid: s.prevTxid, vout: s.prevVout})
          .first()
        if (row?.address) usedAddresses.add(row.address as string)
        const prevSpender = row?.spent_in_txid as string | null | undefined
        if (prevSpender && prevSpender !== s.spentInTxid) conflicted.add(prevSpender)
        await trx('transaction_outputs')
          .where({wallet_id: block.walletId, txid: s.prevTxid, vout: s.prevVout})
          .update({spent_in_txid: s.spentInTxid, spent_at_height: block.height})
      }

      // Pinned here because after a restart the cfilter scan cannot re-detect
      // these spends — their inputs were excluded from the seed.
      for (const tx of block.txs) {
        await trx('transaction_outputs')
          .where({wallet_id: block.walletId, spent_in_txid: tx.txid})
          .whereNull('spent_at_height')
          .update({spent_at_height: block.height})
      }

      // Drop local txs displaced by a conflicting on-chain spend.
      for (const txid of conflicted) {
        await abandonWithinTrx(trx, block.walletId, txid)
      }
      if (usedAddresses.size > 0) {
        const updated = await trx('addresses')
          .where('wallet_id', block.walletId)
          .whereIn('address', [...usedAddresses])
          .andWhere('is_used', false)
          .update({is_used: true})
        console.log(`[walletSync] marked ${updated} address(es) used at h=${block.height} (${usedAddresses.size} candidate(s))`)
      }

      if (advanceCursor) {
        await trx('wallet_sync_state')
          .insert({wallet_id: block.walletId, cfilter_cursor_height: block.height})
          .onConflict('wallet_id')
          .merge({
            cfilter_cursor_height: trx.raw(
              'MAX(wallet_sync_state.cfilter_cursor_height, excluded.cfilter_cursor_height)'
            ),
          })
      }
    })
  }

  // Orphaned txs go back to the block_height 0 sentinel rather than being
  // deleted: one is normally re-mined, and that puts it back in the rebroadcast
  // and isdlock-watch sets. is_used stays set — the address was still revealed.
  rewindToHeight = async (walletId: string, height: number): Promise<void> => {
    await this.knex.transaction(async trx => {
      // An instant lock does not survive its tx losing the chain, so no
      // spender is exempt here.
      await trx('transaction_outputs')
        .where('wallet_id', walletId)
        .andWhere('spent_at_height', '>', height)
        .update({spent_in_txid: null, spent_at_height: null})

      await trx('transactions')
        .where('wallet_id', walletId)
        .andWhere('block_height', '>', height)
        .update({block_height: 0, block_hash: '', chainlocked: false})

      // Only downward: advanceCursor's MAX semantics would ignore this.
      await trx('wallet_sync_state')
        .where('wallet_id', walletId)
        .andWhere('cfilter_cursor_height', '>', height)
        .update({cfilter_cursor_height: height})
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

  // No MAX, unlike advanceCursor: the rewind path has to move the cursor
  // *down* so historical filters re-match newly added addresses.
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

  // Past a full scan to the tip every derived address is frontier-fresh, so
  // hot-adding one must not rewind the cursor. Missing row → never synced.
  getInitialScanComplete = async (walletId: string): Promise<boolean> => {
    const row = await this.knex('wallet_sync_state')
      .select('initial_scan_complete')
      .where({wallet_id: walletId})
      .first()
    return row ? Boolean(row.initial_scan_complete) : false
  }

  // Monotonic latch — set the first time a wallet reaches the tip; never cleared.
  markInitialScanComplete = async (walletId: string): Promise<void> => {
    await this.knex('wallet_sync_state')
      .insert({wallet_id: walletId, initial_scan_complete: true})
      .onConflict('wallet_id')
      .merge({initial_scan_complete: true})
  }

  // ── Pending (locally-broadcast, pre-confirmation) txs ──────────────────────

  // block_height = 0 marks it unconfirmed; inputs are flagged spent so getUtxos
  // stops offering them immediately and outputs are inserted so change is
  // spendable right away. Idempotent, so rebroadcast is safe.
  recordPendingTx = async (walletId: string, tx: AppliedTx, isLocal: boolean): Promise<void> => {
    const now = Date.now()
    await this.knex.transaction(async trx => {
      await trx('transactions')
        .insert({
          wallet_id: walletId,
          txid: tx.txid,
          block_height: 0,
          block_hash: '',
          block_time: Math.floor(now / 1000),
          raw: Buffer.from(tx.raw.buffer, tx.raw.byteOffset, tx.raw.byteLength),
          first_seen_at: now,
          is_local: isLocal,
        })
        .onConflict(['wallet_id', 'txid'])
        .ignore()

      const outputRows = tx.outputs.map(o => ({
        wallet_id: walletId,
        txid: tx.txid,
        vout: o.vout,
        address: o.address,
        satoshis: o.satoshis,
        is_mine: o.isMine,
      }))
      if (outputRows.length > 0) {
        await trx('transaction_outputs').insert(outputRows).onConflict(['wallet_id', 'txid', 'vout']).ignore()
      }

      const inputRows = tx.inputs.map(i => ({
        wallet_id: walletId,
        txid: tx.txid,
        vin: i.vin,
        prev_txid: i.prevTxid,
        prev_vout: i.prevVout,
        sequence: i.sequence,
      }))
      if (inputRows.length > 0) {
        await trx('transaction_inputs').insert(inputRows).onConflict(['wallet_id', 'txid', 'vin']).ignore()
      }

      // Only currently-unspent outputs, so an already-recorded spend is never
      // clobbered. No height yet — the spend is still pending.
      for (const i of tx.inputs) {
        await trx('transaction_outputs')
          .where({wallet_id: walletId, txid: i.prevTxid, vout: i.prevVout})
          .whereNull('spent_in_txid')
          .update({spent_in_txid: tx.txid})
      }

      const usedAddresses = tx.outputs.filter(o => o.isMine && o.address).map(o => o.address as string)
      if (usedAddresses.length > 0) {
        await trx('addresses')
          .where('wallet_id', walletId)
          .whereIn('address', usedAddresses)
          .andWhere('is_used', false)
          .update({is_used: true})
      }
    })
  }

  // Unconfirmed (block_height = 0) txs — for rebroadcast and isdlock watching.
  getPendingTxs = async (walletId: string): Promise<PendingTx[]> => {
    const rows = await this.knex('transactions')
      .select('txid', 'raw', 'first_seen_at', 'instant_locked', 'is_local')
      .where({wallet_id: walletId, block_height: 0})
    return rows.map(r => ({
      txid: r.txid,
      raw: r.raw,
      firstSeenAt: r.first_seen_at ?? 0,
      instantLocked: Boolean(r.instant_locked),
      isLocal: Boolean(r.is_local),
    }))
  }

  getTxLockStatus = async (walletId: string, txid: string): Promise<TxLockStatus> => {
    const row = await this.knex('transactions')
      .select('instant_locked', 'chainlocked', 'block_height')
      .where({wallet_id: walletId, txid})
      .first()
    return {
      instantLocked: Boolean(row?.instant_locked),
      chainlocked: Boolean(row?.chainlocked),
      confirmed: (row?.block_height ?? 0) > 0,
    }
  }

  markInstantLocked = async (txid: string): Promise<void> => {
    await this.knex('transactions')
      .where({txid})
      .update({instant_locked: true})
  }

  // Flag every confirmed tx at or below `height` as chainlocked (irreversible).
  markChainlockedUpTo = async (network: Network, height: number): Promise<void> => {
    await this.knex('transactions')
      .whereIn('wallet_id', this.knex('wallet').select('wallet_id').where({network}))
      .andWhere('block_height', '>', 0)
      .andWhere('block_height', '<=', height)
      .andWhere('chainlocked', false)
      .update({chainlocked: true})
  }

  // Manual "abandon" and automatic conflict resolution. No-op once confirmed.
  abandonTransaction = async (walletId: string, txid: string): Promise<void> => {
    await this.knex.transaction(trx => abandonWithinTrx(trx, walletId, txid))
  }

  // WalletSyncUtxo shape, so the renderer and the cfilter worker's
  // spend-detection seed both consume it without conversion.
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
  getUtxosByAddresses = async (walletId: string, addresses: string[]): Promise<WalletSyncUtxo[]> => {
    if (addresses.length === 0) return []

    const rows = await this.knex('transaction_outputs as o')
      .innerJoin('transactions as t', function() {
        this.on('t.wallet_id', '=', 'o.wallet_id').andOn('t.txid', '=', 'o.txid')
      })
      .select('o.txid', 'o.vout', 'o.address', 'o.satoshis', 't.block_height as height')
      .where('o.wallet_id', walletId)
      .whereIn('o.address', addresses)
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

  getUsedAddresses = async (walletId: string, addresses: string[]): Promise<string[]> => {
    const used = new Set<string>()
    for (let offset = 0; offset < addresses.length; offset += SELECT_CHUNK_SIZE) {
      const rows = await this.knex('transaction_outputs')
        .distinct('address')
        .where('wallet_id', walletId)
        .whereIn('address', addresses.slice(offset, offset + SELECT_CHUNK_SIZE))
      for (const row of rows) used.add(row.address as string)
    }
    return addresses.filter(address => used.has(address))
  }

  // txCount counts the same txids getTransactionsByAddress would return: those
  // paying the address, plus those spending what it received. satoshis is TEXT,
  // so the sum is taken in JS rather than by SQLite.
  getAddressInfos = async (walletId: string, addresses: string[]): Promise<AddressInfo[]> => {
    const balances = new Map<string, bigint>()
    const txids = new Map<string, Set<string>>()

    for (let offset = 0; offset < addresses.length; offset += SELECT_CHUNK_SIZE) {
      const chunk = addresses.slice(offset, offset + SELECT_CHUNK_SIZE)

      const rows = await this.knex('transaction_outputs')
        .select('address', 'txid', 'satoshis', 'spent_in_txid')
        .where('wallet_id', walletId)
        .whereIn('address', chunk)

      for (const row of rows) {
        const address = row.address as string
        if (row.spent_in_txid == null) {
          balances.set(address, (balances.get(address) ?? 0n) + BigInt(row.satoshis))
        }

        const seen = txids.get(address) ?? new Set<string>()
        seen.add(row.txid as string)
        if (row.spent_in_txid != null) seen.add(row.spent_in_txid as string)
        txids.set(address, seen)
      }
    }

    return addresses.map(address => ({
      address,
      balance: balances.get(address) ?? 0n,
      txCount: txids.get(address)?.size ?? 0,
    }))
  }

  // Whole transactions only, so none is left with some inputs described and the
  // rest blank. `afterTxid` walks past what a pass could not resolve.
  getUnresolvedInputs = async (walletId: string, limit: number, afterTxid?: string): Promise<UnresolvedInput[]> => {
    const page = this.unresolvedInputRows(walletId)
      .distinct('i.txid')
      .orderBy('i.txid')
      .limit(limit)
    if (afterTxid != null) page.where('i.txid', '>', afterTxid)

    const rows = await this.unresolvedInputRows(walletId)
      .select('i.txid', 'i.prev_txid', 'i.prev_vout')
      .whereIn('i.txid', page)
      .orderBy(['i.txid', 'i.vin'])

    return rows.map(row => ({txid: row.txid, prevTxid: row.prev_txid, prevVout: row.prev_vout}))
  }

  getUnresolvedInputsForTx = async (walletId: string, txid: string): Promise<PrevOutRef[]> => {
    const rows = await this.unresolvedInputRows(walletId)
      .select('i.prev_txid', 'i.prev_vout')
      .where('i.txid', txid)
      .orderBy('i.vin')

    return rows.map(row => ({prevTxid: row.prev_txid, prevVout: row.prev_vout}))
  }

  // Cached on the input row rather than inserted as an output: transaction_outputs
  // is what the UTXO set and every balance query read, and a stranger's output
  // would have to be born spent to stay out of them.
  recordPrevOuts = async (walletId: string, prevOuts: ResolvedPrevOut[]): Promise<void> => {
    if (prevOuts.length === 0) return

    await this.knex.transaction(async trx => {
      for (const prevOut of prevOuts) {
        await trx('transaction_inputs')
          .where({wallet_id: walletId, prev_txid: prevOut.prevTxid, prev_vout: prevOut.prevVout})
          .update({prev_address: prevOut.address, prev_satoshis: prevOut.satoshis})
      }
    })
  }

  // Written off on disk rather than remembered in the process, so a restart does
  // not go asking for every dead parent again.
  markPrevOutsMissing = async (walletId: string, refs: PrevOutRef[]): Promise<void> => {
    if (refs.length === 0) return

    await this.knex.transaction(async trx => {
      for (const ref of refs) {
        await trx('transaction_inputs')
          .where({wallet_id: walletId, prev_txid: ref.prevTxid, prev_vout: ref.prevVout})
          .update({prev_missing: true})
      }
    })
  }

  // Inputs neither the local output set nor an earlier pass can describe: only
  // our own outputs are stored, so a stranger's has nothing to join to.
  private unresolvedInputRows(walletId: string): Knex.QueryBuilder {
    return this.knex('transaction_inputs as i')
      .leftJoin('transaction_outputs as prev', function() {
        this.on('prev.wallet_id', '=', 'i.wallet_id')
          .andOn('prev.txid', '=', 'i.prev_txid')
          .andOn('prev.vout', '=', 'i.prev_vout')
      })
      .where('i.wallet_id', walletId)
      .whereNull('i.prev_address')
      .where('i.prev_missing', false)
      .whereNull('prev.txid')
      .whereNot('i.prev_txid', COINBASE_PREV_TXID)
  }

  // One query returning the (tx × output × input × prev-output) product, pivoted
  // in JS to one Transaction per txid.
  private transactionRows(walletId: string): Knex.QueryBuilder {
    return this.knex('transactions as t')
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
        // Our own output when there is one, otherwise what the parent
        // transaction was read back as. is_mine deliberately stays on the join:
        // an outpoint that needed resolving is by definition not ours.
        this.knex.raw('COALESCE(prev.address, i.prev_address) as i_prev_address'),
        this.knex.raw('COALESCE(prev.satoshis, i.prev_satoshis) as i_prev_satoshis'),
        't.block_height as t_block_height',
        't.block_time as t_block_time',
        't.instant_locked as t_instant_locked',
        't.chainlocked as t_chainlocked',
        't.is_local as t_is_local',
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
        'prev.is_mine as i_prev_is_mine',
      )
      .where('t.wallet_id', walletId)
  }

  getTransactionsByWallet = async (walletId: string): Promise<Transaction[]> => {
    const rows = await this.transactionRows(walletId).orderBy(['t.txid', 'o.vout', 'i.vin'])

    return shapeRowsToTransactions(rows, walletId)
  }

  getTransactionsByAddress = async (walletId: string, address: string): Promise<Transaction[]> => {
    const txidsForAddress = this.knex('transaction_outputs')
      .select('txid')
      .where({wallet_id: walletId, address})
      .union(builder => builder
        .select('spent_in_txid as txid')
        .from('transaction_outputs')
        .where({wallet_id: walletId, address})
        .whereNotNull('spent_in_txid'))

    const rows = await this.transactionRows(walletId)
      .whereIn('t.txid', txidsForAddress)
      .orderBy(['t.txid', 'o.vout', 'i.vin'])

    return shapeRowsToTransactions(rows, walletId)
  }

  getTransactionByTxid = async (walletId: string, txid: string): Promise<Transaction | undefined> => {
    const rows = await this.transactionRows(walletId)
      .andWhere('t.txid', txid)
      .orderBy(['o.vout', 'i.vin'])

    return shapeRowsToTransactions(rows, walletId)[0]
  }
}

// Frees only inputs held pending, never a confirmed spend, then deletes the
// phantom rows. Confirmed txs are left untouched.
async function abandonWithinTrx(trx: Knex.Transaction, walletId: string, txid: string): Promise<void> {
  const tx = await trx('transactions').select('block_height').where({wallet_id: walletId, txid}).first()
  if (!tx || tx.block_height > 0) return
  await trx('transaction_outputs')
    .where({wallet_id: walletId, spent_in_txid: txid})
    .whereNull('spent_at_height')
    .update({spent_in_txid: null, spent_at_height: null})
  await trx('transaction_outputs').where({wallet_id: walletId, txid}).delete()
  await trx('transaction_inputs').where({wallet_id: walletId, txid}).delete()
  await trx('transactions').where({wallet_id: walletId, txid}).delete()
}

// Collapses the cartesian-product join rows into one Transaction per txid.
// Direction, amounts and primary address come from the is_mine column on each
// output, and on the prev output for inputs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeRowsToTransactions(rows: any[], walletId: string): Transaction[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byTxid = new Map<string, {blockHeight: number; blockTime: number; size: number; instantLocked: boolean; chainlocked: boolean; isLocal: boolean; outputs: Map<number, any>; inputs: Map<number, any>}>()

  for (const row of rows) {
    let acc = byTxid.get(row.t_txid)
    if (!acc) {
      acc = {
        blockHeight: row.t_block_height,
        blockTime: row.t_block_time,
        size: row.t_size,
        instantLocked: Boolean(row.t_instant_locked),
        chainlocked: Boolean(row.t_chainlocked),
        isLocal: Boolean(row.t_is_local),
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
      status: acc.instantLocked || acc.chainlocked ? 'Locked' : 'Pending',
      walletId,
      confirmations: 0,
      txid,
      vin,
      vout,
      instantLocked: acc.instantLocked,
      chainlocked: acc.chainlocked,
      isLocal: acc.isLocal,
    })
  }

  return out
}