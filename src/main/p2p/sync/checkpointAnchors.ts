import type {CFCheckptArgs, Peer} from 'dash-core-p2p'
import {CFCHECKPT_RACE_PEERS, CFCHECKPT_RACE_TIMEOUT_MS, FILTER_TYPE} from '../constants'
import type {PeerRotation} from '../net/peerRotation'
import type {CheckpointAnchorsOptions} from '../types/cfilterSync'

// The filter-header chain's trust anchors: one `getcfcheckpt` gives every
// 1000th filter header up to a stop hash. Every cfheaders chunk is verified
// against these, which is what lets chunks be fetched and checked out of order.
//
// Races a few peers once and keeps the first answer. Past that it is a
// read-only table for the rest of the sync.
export class CheckpointAnchors {
  private readonly headers = new Map<number, Uint8Array>()
  private readonly triedPeers = new Set<Peer>()
  private readonly rotation: PeerRotation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly messages: any
  private readonly stopHashAt: (height: number) => Uint8Array | undefined
  private readonly onReady: (headers: Uint8Array[], fromPeer: Peer) => void

  private raceTimer: ReturnType<typeof setTimeout> | null = null
  private responded = false
  private stopped = false

  constructor(opts: CheckpointAnchorsOptions) {
    this.rotation = opts.rotation
    this.messages = opts.messages
    this.stopHashAt = opts.stopHashAt
    this.onReady = opts.onReady
  }

  get(height: number): Uint8Array | undefined {
    return this.headers.get(height)
  }

  has(height: number): boolean {
    return this.headers.has(height)
  }

  entries(): IterableIterator<[number, Uint8Array]> {
    return this.headers.entries()
  }

  // False when there is nothing to ask or nobody to ask, so the caller knows
  // not to advance the phase. Safe to call again on any of those.
  request(scanTipHeight: number): boolean {
    if (this.stopped) return false
    this.responded = false

    // Highest checkpoint (a real height that is a multiple of 1000) at or below
    // the scan tip, expressed in our internal numbering.
    const stopHeight = Math.floor(scanTipHeight / 1000) * 1000
    const stopHashWire = this.stopHashAt(stopHeight)
    if (!stopHashWire) {
      console.warn(`[cfilter] cfcheckpt: no hash for stop h=${stopHeight}, chain too short`)
      return false
    }

    const picks = this.rotation.pick(CFCHECKPT_RACE_PEERS, this.triedPeers)
    if (picks.length === 0) {
      console.warn('[cfilter] cfcheckpt: no +CF peers — waiting')
      return false
    }

    console.log(`[cfilter] cfcheckpt stopHeight=${stopHeight} picks=${picks.length}`)
    const msg = this.messages.GetCFCheckpt({filterType: FILTER_TYPE, stopHash: stopHashWire})
    for (const p of picks) {
      this.triedPeers.add(p)
      p.sendMessage(msg)
    }

    if (this.raceTimer) clearTimeout(this.raceTimer)
    this.raceTimer = setTimeout(() => {
      if (this.responded || this.stopped) return
      console.warn('[cfilter] cfcheckpt timeout — rotating')
      this.rotation.markSilent(picks)
      this.request(scanTipHeight)
    }, CFCHECKPT_RACE_TIMEOUT_MS)
    return true
  }

  receive(msg: CFCheckptArgs, fromPeer: Peer): void {
    if (this.stopped || this.responded) return
    this.responded = true
    this.triedPeers.clear()
    if (this.raceTimer) {
      clearTimeout(this.raceTimer)
      this.raceTimer = null
    }
    this.rotation.markResponsive(fromPeer)

    const headers = msg.filterHeaders ?? []
    // headers[i] is the filter header at real height (i+1)*1000; key it by the
    // matching internal height.
    for (let i = 0; i < headers.length; i++) this.headers.set((i + 1) * 1000, headers[i]!)

    this.onReady(headers, fromPeer)
  }

  // Cancels an outstanding race but keeps the anchors: they are network-wide
  // facts, so a rewind on our side does not invalidate them.
  reset(): void {
    if (this.raceTimer) {
      clearTimeout(this.raceTimer)
      this.raceTimer = null
    }
  }

  stop(): void {
    this.stopped = true
    this.reset()
  }
}
