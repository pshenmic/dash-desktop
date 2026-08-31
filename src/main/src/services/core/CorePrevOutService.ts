import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {TransactionDAO} from '../../database/TransactionDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {Network} from '../../types/Network'
import {ParentRead, PrevOutPassResult, PrevOutRef, ResolvedPrevOut} from '../../types/Transaction'
import {PREVOUT_RESOLVE_BATCH, PREVOUT_RESOLVE_CONCURRENCY} from '../../constants/chain'
import {chunk} from '../../utils/chunk'
import {coreSDK} from '../../utils/coreSDK'

// Parents come from DAPI, not our own peers: Dash Core answers getdata(MSG_TX)
// out of the mempool and the relay pool only, so a confirmed one is `notfound`
// from every node without -txindex. Evonodes index, so DAPI serves any txid.
export class CorePrevOutService {
  constructor(
    private readonly walletDAO: WalletDAO,
    private readonly transactionDAO: TransactionDAO,
  ) {}

  // Drains the whole backlog rather than one page: once the scan goes quiet
  // nothing triggers another pass but the discovery tick.
  async resolveBacklog(walletId: string): Promise<void> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) return

    const transactions = new Set<string>()
    let after: string | undefined
    let resolved = 0
    let unanswered = 0
    let error: string | null = null

    for (;;) {
      const page = await this.transactionDAO.getUnresolvedInputs(walletId, PREVOUT_RESOLVE_BATCH, after)
      if (page.length === 0) break
      after = page[page.length - 1].txid
      for (const input of page) transactions.add(input.txid)

      const pass = await this.resolveRefs(walletId, wallet.network, page)
      resolved += pass.resolved
      unanswered += pass.unanswered
      error ??= pass.error
    }

    if (resolved === 0 && unanswered === 0) return
    console.log(
      `[prevout] resolved ${resolved} input(s) across ${transactions.size} transaction(s)` +
      (unanswered > 0 ? `, ${unanswered} unanswered${error != null ? ` (${error})` : ''}` : ''),
    )
  }

  // The detail view is the only place per-input data is displayed, so the
  // transaction being opened jumps the backlog.
  async resolveTransaction(walletId: string, txid: string): Promise<void> {
    const refs = await this.transactionDAO.getUnresolvedInputsForTx(walletId, txid)
    if (refs.length === 0) return

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) return

    const pass = await this.resolveRefs(walletId, wallet.network, refs)
    if (pass.unanswered > 0) {
      console.warn(`[prevout] ${txid}: ${pass.unanswered} input(s) unanswered${pass.error != null ? ` (${pass.error})` : ''}`)
    }
  }

  private async resolveRefs(walletId: string, network: Network, refs: PrevOutRef[]): Promise<PrevOutPassResult> {
    const parents = [...Map.groupBy(refs, ref => ref.prevTxid)]
    const resolved: ResolvedPrevOut[] = []
    const missing: PrevOutRef[] = []
    let unanswered = 0
    let error: string | null = null

    // Slices run one after another: the slice size is what caps how many DAPI
    // reads are open at once.
    for (const slice of chunk(parents, PREVOUT_RESOLVE_CONCURRENCY)) {
      const reads = await Promise.all(slice.map(([txid, spent]) => this.readParent(network, txid, spent)))
      error ??= reads.find(read => read.error != null)?.error ?? null

      const outpoints = reads.flatMap(({spent, parent}) =>
        spent.map(ref => ({ref, output: parent?.outputs[ref.prevVout], answered: parent != null})))

      for (const {ref, output, answered} of outpoints) {
        if (output != null) {
          resolved.push({...ref, address: output.getAddress(network) ?? '', satoshis: output.satoshis.toString()})
          continue
        }
        unanswered++
        // A parent that answered without this output will never grow one; a
        // parent that never answered may.
        if (answered) missing.push(ref)
      }
    }

    await this.transactionDAO.recordPrevOuts(walletId, resolved)
    await this.transactionDAO.markPrevOutsMissing(walletId, missing)
    return {resolved: resolved.length, unanswered, error}
  }

  // Caught per parent rather than per slice: an evonode that cannot answer for
  // one parent says nothing about the rest of them.
  private async readParent(network: Network, txid: string, spent: PrevOutRef[]): Promise<ParentRead> {
    try {
      const {transaction} = await coreSDK(network).getTransaction(txid)
      return {spent, parent: SDKTransaction.fromBytes(transaction), error: null}
    } catch (err) {
      return {spent, parent: null, error: err instanceof Error ? err.message : String(err)}
    }
  }
}
