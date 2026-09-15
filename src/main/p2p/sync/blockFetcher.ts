import {Inventory, type Message, type Peer} from 'dash-core-p2p'
import {BLOCK_REQUEST_SEEN_LIMIT, BLOCK_REQUEST_TIMEOUT_MS} from '../constants'
import type {PeerRotation} from '../net/peerRotation'
import type {BlockRequest, BlockFetcherOptions} from '../types/cfilterSync'
import {Logger} from '../../src/utils/logger'

const log = new Logger('cfilter')

function keyOf(hashWire: Uint8Array): string {
  return Buffer.from(hashWire).toString('hex')
}

// Full blocks for the heights a filter matched. One peer at a time with a
// retry timer, rather than a race: a block is ~2MB against a cfilter's few
// hundred bytes, so a duplicate costs more than the latency it saves.
//
// Blocks arrive only because we asked, so the inflight entry carries the height
// and no chain-wide hash→height map has to exist.
export class BlockFetcher {
  private readonly inflight = new Map<string, BlockRequest>()
  // Hashes that were ours and no longer are, so a late second copy can be told
  // from a block nobody asked for.
  private readonly retired = new Set<string>()
  private readonly rotation: PeerRotation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly messages: any
  private stopped = false

  constructor(opts: BlockFetcherOptions) {
    this.rotation = opts.rotation
    this.messages = opts.messages
  }

  get size(): number {
    return this.inflight.size
  }

  // Infinity when nothing is outstanding, so it can be MIN'd into a settled
  // height without a special case.
  lowestHeight(): number {
    let lowest = Infinity
    for (const entry of this.inflight.values()) lowest = Math.min(lowest, entry.height)
    return lowest
  }

  heights(): number[] {
    return [...this.inflight.values()].map(e => e.height).sort((a, b) => a - b)
  }

  request(height: number, hashWire: Uint8Array): void {
    if (this.stopped) return
    const key = keyOf(hashWire)
    if (this.inflight.has(key)) return

    const entry: BlockRequest = {hashWire, height, triedPeers: new Set(), timer: null}
    this.inflight.set(key, entry)

    const target = this.rotation.first(entry.triedPeers)
    if (target) {
      entry.triedPeers.add(target)
      target.sendMessage(this.getData(hashWire))
    } else {
      log.warn(`block h=${height} matched but no ready peers — retrying on timer`)
    }
    this.arm(key, entry)
  }

  // The height the block was requested for, or null if nobody asked for it.
  receive(peer: Peer, hashWire: Uint8Array): number | null {
    this.rotation.markResponsive(peer)
    const key = keyOf(hashWire)
    const pending = this.inflight.get(key)
    if (!pending) return null
    if (pending.timer) clearTimeout(pending.timer)
    this.inflight.delete(key)
    this.retire(key)
    return pending.height
  }

  // Whether this block was ever requested. A retry leaves two peers holding the
  // same getdata and a rewind abandons the lot, so both deliver blocks nothing
  // is waiting for — unlike one arriving unbidden.
  wasRequested(hashWire: Uint8Array): boolean {
    return this.retired.has(keyOf(hashWire))
  }

  // The peer answered, but with a block the caller could not verify. The
  // request stays outstanding and moves to someone else now rather than waiting
  // out the retry timer. Null when nobody asked for this hash.
  reject(hashWire: Uint8Array): number | null {
    const key = keyOf(hashWire)
    const entry = this.inflight.get(key)
    if (entry == null) return null
    this.retry(key, entry, 'rejected')
    return entry.height
  }

  // Drops everything outstanding without ending the fetcher — a rewind
  // invalidates the requests but the worker keeps running.
  reset(): void {
    for (const [key, entry] of this.inflight) {
      if (entry.timer) clearTimeout(entry.timer)
      this.retire(key)
    }
    this.inflight.clear()
  }

  private retire(key: string): void {
    if (this.retired.size >= BLOCK_REQUEST_SEEN_LIMIT) this.retired.clear()
    this.retired.add(key)
  }

  stop(): void {
    this.stopped = true
    this.reset()
  }

  private getData(hashWire: Uint8Array): Message {
    return this.messages.GetData([{type: Inventory.TYPE.BLOCK, hash: hashWire}])
  }

  // `reason` names what the last peer did, since a timeout and a block that
  // failed verification recover the same way.
  private retry(key: string, entry: BlockRequest, reason: string): void {
    let next = this.rotation.first(entry.triedPeers)
    if (!next) {
      entry.triedPeers.clear()
      next = this.rotation.first(entry.triedPeers)
      if (!next) {
        log.warn(`block h=${entry.height} ${reason} — no ready peers, re-arming`)
        this.arm(key, entry)
        return
      }
      log.warn(`block h=${entry.height} ${reason} — no fresh peers, re-asking ${next.host}`)
    } else {
      log.warn(`block h=${entry.height} ${reason} — retrying via ${next.host} (tried ${entry.triedPeers.size})`)
    }
    entry.triedPeers.add(next)
    next.sendMessage(this.getData(entry.hashWire))
    this.arm(key, entry)
  }

  private arm(key: string, entry: BlockRequest): void {
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      if (this.stopped || !this.inflight.has(key)) return
      // Whoever was asked did not deliver, so they stop being a first choice
      // here and on the cf* paths until they answer something.
      this.rotation.markSilent(entry.triedPeers)
      this.retry(key, entry, 'timeout')
    }, BLOCK_REQUEST_TIMEOUT_MS)
  }
}
