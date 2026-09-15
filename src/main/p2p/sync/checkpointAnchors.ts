import type {CFCheckptArgs, Peer} from 'dash-core-p2p'
import {
  CFCHECKPT_AGREE_PEERS,
  CFCHECKPT_RACE_PEERS,
  CFCHECKPT_RACE_TIMEOUT_MS,
  FILTER_TYPE,
  HASH_LEN,
} from '../constants'
import {doubleSHA256} from '../utils/hash'
import type {PeerRotation} from '../net/peerRotation'
import type {CheckpointAnchorsOptions} from '../types/cfilterSync'
import {Logger} from '../../src/utils/logger'

const log = new Logger('cfilter')

// One key per distinct answer, so agreement is a lookup instead of comparing
// every vector against every other.
function digest(headers: Uint8Array[]): string {
  const flat = new Uint8Array(headers.length * HASH_LEN)
  for (let i = 0; i < headers.length; i++) flat.set(headers[i]!, i * HASH_LEN)
  return Buffer.from(doubleSHA256(flat)).toString('hex')
}

// The filter-header chain's trust anchors: one `getcfcheckpt` gives every
// 1000th filter header up to a stop hash. Every cfheaders chunk is verified
// against these, which is what lets chunks be fetched and checked out of order.
//
export class CheckpointAnchors {
  private readonly headers = new Map<number, Uint8Array>()
  private readonly triedPeers = new Set<Peer>()
  // Distinct answers to the current stop hash and who gave each. Held across
  // retries so a quorum can still be reached a peer at a time on a thin pool.
  private readonly answers = new Map<string, {headers: Uint8Array[]; peers: Set<Peer>}>()
  // Who replied to the round in flight, so the rotation benches only the peers
  // that stayed silent — the few that do answer are the ones to keep asking.
  private readonly replied = new Set<Peer>()
  private readonly rotation: PeerRotation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly messages: any
  private readonly stopHashAt: (height: number) => Uint8Array | undefined
  private readonly onReady: (headers: Uint8Array[], fromPeer: Peer) => void
  private readonly poolCanGrow: () => boolean

  private raceTimer: ReturnType<typeof setTimeout> | null = null
  private asked = 0
  private stopHeight = 0
  private settled = false
  private stopped = false

  constructor(opts: CheckpointAnchorsOptions) {
    this.rotation = opts.rotation
    this.messages = opts.messages
    this.stopHashAt = opts.stopHashAt
    this.onReady = opts.onReady
    this.poolCanGrow = opts.poolCanGrow
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

  // False when there is nothing to ask or nobody to ask
  request(scanTipHeight: number): boolean {
    if (this.stopped) return false

    // Highest checkpoint (a real height that is a multiple of 1000) at or below
    // the scan tip, expressed in our internal numbering.
    const stopHeight = Math.floor(scanTipHeight / 1000) * 1000
    const stopHashWire = this.stopHashAt(stopHeight)
    if (!stopHashWire) {
      log.warn(`cfcheckpt: no hash for stop h=${stopHeight}, chain too short`)
      return false
    }

    // A different stop hash is a different question, and answers to the old one
    // say nothing about it.
    if (stopHeight !== this.stopHeight) {
      this.stopHeight = stopHeight
      this.answers.clear()
      this.triedPeers.clear()
    }
    this.settled = false

    const picks = this.rotation.pick(CFCHECKPT_RACE_PEERS, this.triedPeers)
    if (picks.length === 0) {
      log.warn('cfcheckpt: no +CF peers — waiting')
      return false
    }

    log.info(`cfcheckpt stopHeight=${stopHeight} picks=${picks.length}`)
    this.asked = picks.length
    this.replied.clear()
    const msg = this.messages.GetCFCheckpt({filterType: FILTER_TYPE, stopHash: stopHashWire})
    for (const p of picks) {
      this.triedPeers.add(p)
      p.sendMessage(msg)
    }

    if (this.raceTimer) clearTimeout(this.raceTimer)
    this.raceTimer = setTimeout(() => {
      if (this.settled || this.stopped) return
      this.rotation.markSilent(picks.filter(p => !this.replied.has(p)))

      // One uncontradicted answer is as much as this network usually supplies,
      // and holding out for a second stalls the scan for good. Contradicting
      // answers are the case worth being stubborn about, so those keep asking.
      const [only] = [...this.answers.values()]
      if (this.answers.size === 1 && only != null) {
        log.warn(
          `cfcheckpt h=${stopHeight}: ${only.peers.size} of ${CFCHECKPT_AGREE_PEERS} peers confirmed these anchors ` +
          `(${[...only.peers].map(p => p.host).join(',')} of ${picks.length} asked) — proceeding unconfirmed`,
        )
        this.settle(only)
        return
      }
      this.request(scanTipHeight)
    }, CFCHECKPT_RACE_TIMEOUT_MS)
    return true
  }

  receive(msg: CFCheckptArgs, fromPeer: Peer): void {
    if (this.stopped || this.settled) return
    this.rotation.markResponsive(fromPeer)
    this.replied.add(fromPeer)

    const headers = msg.filterHeaders ?? []
    // The stop hash names exactly one checkpoint per 1000 blocks below it.
    const expected = this.stopHeight / 1000
    if (headers.length !== expected || headers.some(h => h.length !== HASH_LEN)) {
      log.warn(`cfcheckpt from ${fromPeer.host}: ${headers.length} anchors for h=${this.stopHeight}, expected ${expected} — ignored`)
      return
    }

    const key = digest(headers)
    let group = this.answers.get(key)
    if (group == null) {
      if (this.answers.size > 0) {
        log.warn(`cfcheckpt h=${this.stopHeight}: ${fromPeer.host} contradicts ${this.answers.size} other answer(s) — one of them is lying`)
      }
      group = {headers, peers: new Set<Peer>()}
      this.answers.set(key, group)
    }
    group.peers.add(fromPeer)
    if (group.peers.size >= CFCHECKPT_AGREE_PEERS) {
      this.settle(group)
      return
    }

    // Static mode pins the peer set and allows a single peer, so the timeout
    // would settle on this answer anyway — five seconds later.
    if (!this.poolCanGrow() && this.asked < CFCHECKPT_AGREE_PEERS && this.answers.size === 1) {
      log.warn(`cfcheckpt h=${this.stopHeight}: ${fromPeer.host} is the only peer to ask — proceeding unconfirmed`)
      this.settle(group)
    }
  }

  private settle(group: {headers: Uint8Array[]; peers: Set<Peer>}): void {
    this.settled = true
    this.triedPeers.clear()
    if (this.raceTimer) {
      clearTimeout(this.raceTimer)
      this.raceTimer = null
    }

    // headers[i] is the filter header at real height (i+1)*1000; key it by the
    // matching internal height.
    for (let i = 0; i < group.headers.length; i++) this.headers.set((i + 1) * 1000, group.headers[i]!)

    this.onReady(group.headers, [...group.peers][0]!)
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
