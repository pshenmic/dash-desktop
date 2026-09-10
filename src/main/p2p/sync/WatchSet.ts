import {Block, OutPoint, Script, utils as sdkUtils} from 'dash-core-sdk'
import {Network} from '../../src/types/Network'
import type {
  AppliedSpend,
  AppliedTx,
  AppliedTxInput,
  AppliedTxOutput,
  BlockMatch,
  ChainGapState,
  WalletSyncUtxo,
  WatchAddress,
} from '../types/walletSync'
import {Logger} from '../../src/utils/logger'

const log = new Logger('cfilter')

const {addressToPublicKeyHash} = sdkUtils

function p2pkhScript(address: string): Uint8Array {
  const s = new Script()
  s.pushOpCode('OP_DUP')
  s.pushOpCode('OP_HASH160')
  s.pushOpCode('OP_PUSHBYTES_20', addressToPublicKeyHash(address))
  s.pushOpCode('OP_EQUALVERIFY')
  s.pushOpCode('OP_CHECKSIG')
  return s.bytes()
}

// What a wallet is scanning for, and the block matching that maintains it.
//
// `items` carries our outpoints as well as our scripts, because a purely
// outgoing transaction — one spending our UTXOs without paying any of our
// addresses — matches no script of ours and would otherwise be missed.
export class WatchSet {
  private readonly network: Network
  readonly gapLimit: number
  private readonly addresses = new Set<string>()
  private readonly byAddress = new Map<string, WatchAddress>()
  private matchItems: Uint8Array[] = []
  private itemsRevision = 0
  private utxos = new Map<string, WalletSyncUtxo>()
  private gap: Record<'receiving' | 'change', ChainGapState> = {
    receiving: {maxIndex: -1, lastUsed: -1},
    change: {maxIndex: -1, lastUsed: -1},
  }

  constructor(network: Network, gapLimit: number, addresses: WatchAddress[]) {
    this.network = network
    this.gapLimit = gapLimit
    for (const a of addresses) this.add(a)
  }

  // The cfilter match set (GCS membership test input).
  get items(): Uint8Array[] {
    return this.matchItems
  }

  // Bumped whenever `items` changes, so a consumer that caches a view of the
  // set — the native FilterMatcher — can tell when its copy is stale.
  get revision(): number {
    return this.itemsRevision
  }

  get size(): number {
    return this.addresses.size
  }

  get utxoCount(): number {
    return this.utxos.size
  }

  totalSatoshis(): bigint {
    let total = 0n
    for (const u of this.utxos.values()) total += BigInt(u.satoshis)
    return total
  }

  gapState(chain: 'receiving' | 'change'): ChainGapState {
    return this.gap[chain]
  }

  add(a: WatchAddress): boolean {
    if (this.addresses.has(a.address)) return false
    this.addresses.add(a.address)
    this.byAddress.set(a.address, a)
    this.matchItems.push(p2pkhScript(a.address))
    this.itemsRevision++
    const chain = this.gap[a.isChange ? 'change' : 'receiving']
    if (a.index > chain.maxIndex) chain.maxIndex = a.index
    if (a.isUsed && a.index > chain.lastUsed) chain.lastUsed = a.index
    return true
  }

  // Rebuilt rather than appended to, so that after a rewind the orphaned
  // outpoints leave the match set.
  setUtxos(utxos: WalletSyncUtxo[]): void {
    this.utxos = new Map(utxos.map(u => [`${u.txid}:${u.vout}`, u]))
    this.matchItems = [
      ...[...this.addresses].map(p2pkhScript),
      ...utxos.map(u => new OutPoint(u.txid, u.vout).bytes()),
    ]
    this.itemsRevision++
  }

  // Fewer than gapLimit unused addresses above the highest used index means a
  // payment to an address we have not derived can no longer be ruled out.
  exhaustedChain(): 'receiving' | 'change' | null {
    for (const name of ['receiving', 'change'] as const) {
      const chain = this.gap[name]
      if (chain.lastUsed + this.gapLimit > chain.maxIndex) return name
    }
    return null
  }

  // Null when the block touches nothing of ours. Blocks must arrive in height
  // order: an output has to be recorded before the block spending it.
  applyBlock(block: Block, height: number): BlockMatch | null {
    const txs: AppliedTx[] = []
    const spends: AppliedSpend[] = []

    for (const tx of block.txs) {
      const txid = tx.hash()
      const inputs: AppliedTxInput[] = []
      const outputs: AppliedTxOutput[] = []
      let isOurs = false

      for (let vin = 0; vin < tx.inputs.length; vin++) {
        const input = tx.inputs[vin]!
        inputs.push({vin, prevTxid: input.txId, prevVout: input.vOut, sequence: input.sequence})
        const u = this.utxos.get(`${input.txId}:${input.vOut}`)
        if (u) {
          spends.push({prevTxid: u.txid, prevVout: u.vout, spentInTxid: txid})
          this.utxos.delete(`${input.txId}:${input.vOut}`)
          isOurs = true
          log.info(`spent ${u.txid.slice(0, 16)}…:${u.vout} -${u.satoshis} h=${height}`)
        }
      }

      for (let vout = 0; vout < tx.outputs.length; vout++) {
        const output = tx.outputs[vout]!
        const address = output.getAddress(this.network === 'mainnet' ? 'Mainnet' : 'Testnet')
        const isMine = !!(address && this.addresses.has(address))
        outputs.push({vout, address: address ?? null, satoshis: output.satoshis.toString(), isMine})
        if (!isMine) continue
        const watched = this.byAddress.get(address!)
        if (watched) {
          const chain = this.gap[watched.isChange ? 'change' : 'receiving']
          if (watched.index > chain.lastUsed) chain.lastUsed = watched.index
        }
        const k = `${txid}:${vout}`
        if (this.utxos.has(k)) continue
        const u: WalletSyncUtxo = {txid, vout, satoshis: output.satoshis.toString(), address: address!, height}
        this.utxos.set(k, u)
        this.matchItems.push(new OutPoint(txid, vout).bytes())
        this.itemsRevision++
        isOurs = true
        log.info(`received ${txid.slice(0, 16)}…:${vout} +${u.satoshis} h=${height} (${address})`)
      }

      if (isOurs) txs.push({txid, raw: tx.bytes(), inputs, outputs})
    }

    if (txs.length === 0 && spends.length === 0) return null
    return {txs, spends}
  }
}
