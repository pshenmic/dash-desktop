import {Inventory, type Message, type Peer} from 'dash-core-p2p'
import {BLOCK_REQUEST_TIMEOUT_MS} from '../constants'
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
    return pending.height
  }

  // Drops everything outstanding without ending the fetcher — a rewind
  // invalidates the requests but the worker keeps running.
  reset(): void {
    for (const entry of this.inflight.values()) {
      if (entry.timer) clearTimeout(entry.timer)
    }
    this.inflight.clear()
  }

  stop(): void {
    this.stopped = true
    this.reset()
  }

  private getData(hashWire: Uint8Array): Message {
    return this.messages.GetData([{type: Inventory.TYPE.BLOCK, hash: hashWire}])
  }

  private arm(key: string, entry: BlockRequest): void {
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      if (this.stopped || !this.inflight.has(key)) return
      // Whoever was asked did not deliver, so they stop being a first choice
      // here and on the cf* paths until they answer something.
      this.rotation.markSilent(entry.triedPeers)

      let next = this.rotation.first(entry.triedPeers)
      if (!next) {
        entry.triedPeers.clear()
        next = this.rotation.first(entry.triedPeers)
        if (!next) {
          log.warn(`block h=${entry.height} retry — no ready peers, re-arming`)
          this.arm(key, entry)
          return
        }
        log.warn(`block h=${entry.height} retry — no fresh peers, re-asking ${next.host}`)
      } else {
        log.warn(`block h=${entry.height} timeout — retrying via ${next.host} (tried ${entry.triedPeers.size})`)
      }
      entry.triedPeers.add(next)
      next.sendMessage(this.getData(entry.hashWire))
      this.arm(key, entry)
    }, BLOCK_REQUEST_TIMEOUT_MS)
  }
}
