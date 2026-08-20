import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {TransactionDAO} from '../../database/TransactionDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {Network} from '../../types/Network'
import {PrevOutRef, ResolvedPrevOut} from '../../types/Transaction'
import {PREVOUT_RESOLVE_BATCH, PREVOUT_RESOLVE_CONCURRENCY} from '../../constants'
import {coreSDK} from '../../utils/coreSDK'

// Parents come from DAPI, not our own peers: Dash Core answers getdata(MSG_TX)
// out of the mempool and the relay pool only, so a confirmed one is `notfound`
// from every node without -txindex. Evonodes index, so DAPI serves any txid.
export class CorePrevOutService {
  private inflight = new Map<string, Promise<void>>()

  constructor(
    private readonly walletDAO: WalletDAO,
    private readonly transactionDAO: TransactionDAO,
  ) {}

  resolvePrevOuts(walletId: string): Promise<void> {
    const existing = this.inflight.get(walletId)
    if (existing) return existing
    const run = this.runResolution(walletId).finally(() => this.inflight.delete(walletId))
    this.inflight.set(walletId, run)
    return run
  }

  private async runResolution(walletId: string): Promise<void> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (!wallet) return
    const network = wallet.network as Network

    const pending = await this.transactionDAO.getUnresolvedInputs(walletId)
    if (pending.length === 0) return

    const byTx = new Map<string, PrevOutRef[]>()
    for (const input of pending) {
      const refs = byTx.get(input.txid) ?? []
      refs.push({prevTxid: input.prevTxid, prevVout: input.prevVout})
      byTx.set(input.txid, refs)
    }

    // Whole transactions only, even when one takes the pass past the cap: a pass
    // that stopped mid-transaction would leave the detail view showing some of
    // its inputs and blanks for the rest until the next one ran.
    const parents = new Map<string, PrevOutRef[]>()
    let taken = 0
    for (const refs of byTx.values()) {
      if (parents.size >= PREVOUT_RESOLVE_BATCH) break
      for (const ref of refs) {
        const grouped = parents.get(ref.prevTxid) ?? []
        grouped.push(ref)
        parents.set(ref.prevTxid, grouped)
      }
      taken++
    }

    const batch = [...parents.entries()]
    const label = network === 'mainnet' ? 'Mainnet' : 'Testnet'
    const resolved: ResolvedPrevOut[] = []
    let missing = 0

    for (let offset = 0; offset < batch.length; offset += PREVOUT_RESOLVE_CONCURRENCY) {
      const slice = batch.slice(offset, offset + PREVOUT_RESOLVE_CONCURRENCY)
      const fetched = await Promise.all(slice.map(([txid]) => this.fetchTransaction(txid, network)))

      fetched.forEach((parent, i) => {
        if (parent == null) {
          missing++
          return
        }
        for (const ref of slice[i][1]) {
          const output = parent.outputs[ref.prevVout]
          if (output == null) {
            missing++
            continue
          }
          resolved.push({
            ...ref,
            address: output.getAddress(label) ?? '',
            satoshis: output.satoshis.toString(),
          })
        }
      })
    }

    await this.transactionDAO.recordPrevOuts(walletId, resolved)
    console.log(
      `[prevout] resolved ${resolved.length} input(s) of ${taken} transaction(s) ` +
      `from ${batch.length} parent transaction(s)` +
      (missing > 0 ? `, ${missing} unanswered` : '') +
      (byTx.size > taken ? `, ${byTx.size - taken} transaction(s) left for the next pass` : ''),
    )
  }

  // Null rather than throwing: an evonode that cannot answer for one parent says
  // nothing about the rest of the batch, and the next pass asks again.
  private async fetchTransaction(txid: string, network: Network): Promise<SDKTransaction | null> {
    try {
      const {transaction} = await coreSDK(network).getTransaction(txid)
      return SDKTransaction.fromBytes(transaction)
    } catch (err) {
      console.warn(`[prevout] parent ${txid} unavailable: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }
}
