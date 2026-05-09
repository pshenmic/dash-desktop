import {Message, Peer} from 'dash-core-p2p'
import {utils as coreUtils} from 'dash-core-sdk'
import {ChainStore} from '../ChainStore'
import {PersistedHeader, ChainTipState} from '../ChainDAO'
import {PeerPool} from '../PeerPool'
import {
  bitsToTarget,
  hashHeaderRaw,
  MAX_FUTURE_BLOCK_TIME,
  POW_LIMIT_TARGET,
  rawPrevHash,
} from '../pow'
import {Worker} from './Worker'

const HEADER_SYNC_TIMEOUT_MS = 30_000
const HEADER_RACE_PEERS = 12

const INV_TYPE_NAMES: Record<number, string> = {
  0: 'ERROR', 1: 'TX', 2: 'BLOCK', 3: 'FILTERED_BLOCK',
  16: 'DSTX', 29: 'CLSIG', 30: 'ISLOCK', 31: 'ISDLOCK',
}

function typeName(t: number): string {
  return INV_TYPE_NAMES[t] ?? `UNKNOWN(${t})`
}

export type HeaderSyncPhase = 'connecting' | 'syncing-headers' | 'synced' | 'stopped'

export interface HeaderSyncWorkerStatus {
  phase: HeaderSyncPhase
  tipHeight: number
  tipHash: string | null
  estimatedChainHeight: number
  peerCount: number
}

export interface HeaderSyncWorkerOptions {
  chainStore: ChainStore
  peerPool: PeerPool
  initialTipHeight: number
  initialTipHash: string
}

interface HeaderRace {
  locator: string
  racers: Set<Peer>
  zeroResponses: number
  timer: ReturnType<typeof setTimeout> | null
}

// Header chain extension worker. Drives a `getheaders` race against ready
// peers from the shared PeerPool, validates returned headers (PoW only;
// DGWv3 difficulty is deliberately disabled — see comment in processHeaders),
// persists them via ChainStore, and exposes:
//   - 'status' event       — HeaderSyncWorkerStatus, fires on every progress
//   - 'chainExtended' event — PersistedHeader[], fires after each successful
//                             append; CFilterSyncWorker uses it to extend its
//                             in-memory chain index for live tip following.
export class HeaderSyncWorker extends Worker {
  readonly name = 'HeaderSyncWorker'

  private chainStore: ChainStore
  private peerPool: PeerPool

  private chainTipHeight: number
  private chainTipHash: string
  private maxPeerHeight = 0

  private currentRace: HeaderRace | null = null
  private phase: HeaderSyncPhase = 'connecting'
  private stopped = false

  // Bound listener references so stop() can detach cleanly.
  private onPeerReady = (peer: Peer): void => this.handlePeerReady(peer)
  private onPeerHeaders = (peer: Peer, msg: Message & { headers?: Uint8Array[] }): void =>
    this.handlePeerHeaders(peer, msg.headers ?? [])
  private onPeerInv = (peer: Peer, msg: Message & { inventory?: Array<{ type: number }> }): void =>
    this.handlePeerInv(peer, msg.inventory ?? [])
  private onPeerDisconnect = (peer: Peer): void => this.handlePeerDisconnect(peer)

  constructor(opts: HeaderSyncWorkerOptions) {
    super()
    this.chainStore = opts.chainStore
    this.peerPool = opts.peerPool
    this.chainTipHeight = opts.initialTipHeight
    this.chainTipHash = opts.initialTipHash
  }

  start = (): void => {
    this.peerPool.on('peerready', this.onPeerReady)
    this.peerPool.on('peerheaders', this.onPeerHeaders)
    this.peerPool.on('peerinv', this.onPeerInv)
    this.peerPool.on('peerdisconnect', this.onPeerDisconnect)
    this.emitStatus('connecting')

    // Any peers already ready when we attached should kick off the race.
    for (const peer of this.peerPool.readyPeers) this.handlePeerReady(peer)
  }

  stop = (): void => {
    if (this.stopped) return
    this.stopped = true
    if (this.currentRace?.timer) clearTimeout(this.currentRace.timer)
    this.currentRace = null
    this.peerPool.off('peerready', this.onPeerReady)
    this.peerPool.off('peerheaders', this.onPeerHeaders)
    this.peerPool.off('peerinv', this.onPeerInv)
    this.peerPool.off('peerdisconnect', this.onPeerDisconnect)
    this.phase = 'stopped'
    this.emitStatus('stopped')
  }

  // ── status ────────────────────────────────────────────────────────────────

  private emitStatus(phase: HeaderSyncPhase): void {
    this.phase = phase
    const status: HeaderSyncWorkerStatus = {
      phase,
      tipHeight: this.chainTipHeight,
      tipHash: this.chainTipHash || null,
      estimatedChainHeight: Math.max(this.maxPeerHeight, this.chainTipHeight),
      peerCount: this.peerPool.readyPeers.size,
    }
    this.emit('status', status)
  }

  // ── peer event handlers ───────────────────────────────────────────────────

  private handlePeerReady(peer: Peer): void {
    if (this.stopped) return
    const best = (peer as { bestHeight?: number }).bestHeight ?? 0
    if (best > this.maxPeerHeight) this.maxPeerHeight = best
    console.log(`[p2p] peerready ${peer.host}:${peer.port} v${peer.version} bestHeight=${peer.bestHeight} ready=${this.peerPool.readyPeers.size}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    peer.sendMessage((this.peerPool.messages as any).SendHeaders())

    if (this.phase === 'connecting' || this.phase === 'syncing-headers') {
      if (this.phase === 'connecting') this.emitStatus('syncing-headers')
      if (!this.currentRace) {
        this.startHeaderRace()
      } else if (this.currentRace.racers.size < HEADER_RACE_PEERS) {
        this.currentRace.racers.add(peer)
        peer.sendMessage(this.getHeadersMsg(this.currentRace.locator))
      }
    }
  }

  private handlePeerInv(peer: Peer, inventory: Array<{ type: number }>): void {
    const counts: Record<number, number> = {}
    for (const item of inventory) counts[item.type] = (counts[item.type] ?? 0) + 1
    const summary = Object.entries(counts).map(([t, n]) => `${typeName(Number(t))}=${n}`).join(' ')
    console.log(`[p2p] peerinv from ${peer.host} ${summary || '(empty)'}`)
  }

  private handlePeerHeaders(peer: Peer, rawHeaders: Uint8Array[]): void {
    if (this.stopped) return
    console.log(`[p2p] peerheaders ${peer.host} count=${rawHeaders.length} phase=${this.phase}`)

    if (this.phase !== 'syncing-headers') {
      // Tip-following: post-sync, accept unsolicited extensions.
      if (rawHeaders.length === 0 || rawHeaders[0]!.length < 80) return
      if (rawPrevHash(rawHeaders[0]!) !== this.chainTipHash) return
      this.processHeaders(rawHeaders).catch(err => {
        console.error('[p2p] processHeaders (tip-follow) failed:', err)
      })
      return
    }

    const race = this.currentRace
    if (!race || !race.racers.has(peer)) return

    if (rawHeaders.length > 0) {
      if (rawHeaders[0]!.length < 80) {
        race.racers.delete(peer)
        return
      }
      if (rawPrevHash(rawHeaders[0]!) !== race.locator) return
    }

    race.racers.delete(peer)

    if (rawHeaders.length === 0) {
      race.zeroResponses++
      const agreeThreshold = Math.min(2, Math.max(1, this.peerPool.readyPeers.size))
      if (race.zeroResponses >= agreeThreshold) {
        this.finishHeaderSync()
      } else if (race.racers.size === 0) {
        this.endRace(race)
        this.startHeaderRace()
      }
      return
    }

    this.processHeaders(rawHeaders).then(advanced => {
      if (this.stopped) return
      if (!advanced) {
        if (race.racers.size === 0 && race.zeroResponses === 0) {
          this.endRace(race)
          this.startHeaderRace()
        }
        return
      }
      this.endRace(race)
      this.startHeaderRace()
    }).catch(err => {
      console.error('[p2p] processHeaders failed:', err)
      this.endRace(race)
      if (this.phase === 'syncing-headers') this.startHeaderRace()
    })
  }

  private handlePeerDisconnect(peer: Peer): void {
    console.log(`[p2p] peerdisconnect ${peer.host}:${peer.port} ready=${this.peerPool.readyPeers.size}`)
    const race = this.currentRace
    if (race && race.racers.has(peer)) {
      race.racers.delete(peer)
      if (race.racers.size === 0) {
        this.endRace(race)
        if (this.phase === 'syncing-headers') this.startHeaderRace()
      }
    }
  }

  // ── race machinery ────────────────────────────────────────────────────────

  private getHeadersMsg(locator: string): Message {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.peerPool.messages as any).GetHeaders({
      starts: [coreUtils.hexToBytes(locator).reverse()],
      stop: new Uint8Array(32),
    })
  }

  private startHeaderRace(): void {
    if (this.stopped || this.peerPool.readyPeers.size === 0 || this.currentRace) return

    const picks: Peer[] = []
    for (const p of this.peerPool.readyPeers) {
      picks.push(p)
      if (picks.length >= HEADER_RACE_PEERS) break
    }
    if (picks.length === 0) return

    const locator = this.chainTipHash
    const race: HeaderRace = {locator, racers: new Set(picks), zeroResponses: 0, timer: null}
    this.currentRace = race

    const msg = this.getHeadersMsg(locator)
    for (const p of picks) p.sendMessage(msg)
    console.log(`[p2p] race start locator=${locator} height=${this.chainTipHeight} racers=${picks.length}`)

    race.timer = setTimeout(() => {
      if (this.currentRace !== race) return
      console.warn(`[p2p] race at ${locator} timed out`)
      this.endRace(race)
      this.startHeaderRace()
    }, HEADER_SYNC_TIMEOUT_MS)
  }

  private endRace(race: HeaderRace): void {
    if (race.timer) {
      clearTimeout(race.timer)
      race.timer = null
    }
    if (this.currentRace === race) this.currentRace = null
  }

  private finishHeaderSync(): void {
    if (this.currentRace) this.endRace(this.currentRace)
    this.emitStatus('synced')
  }

  // Validate + persist a batch of raw 80-byte headers. See the original
  // headerSync.ts for the rationale; preserved verbatim here. DGWv3
  // difficulty validation stays disabled until a checkpoint anchors it.
  private async processHeaders(rawHeaders: Uint8Array[]): Promise<boolean> {
    console.log(`[p2p] processHeaders: ${rawHeaders.length}`)
    if (rawHeaders.length === 0) return false

    const futureLimit = Math.floor(Date.now() / 1000) + MAX_FUTURE_BLOCK_TIME
    let prevHash = this.chainTipHash
    let h = this.chainTipHeight
    const accepted: PersistedHeader[] = []

    for (const raw of rawHeaders) {
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
      const time = dv.getUint32(68, true)
      const nBits = dv.getUint32(72, true)
      const incomingPrev = rawPrevHash(raw)

      if (incomingPrev !== prevHash) {
        console.warn(`[p2p] reject ~h=${h + 1} prev mismatch got=${incomingPrev} want=${prevHash}`)
        return false
      }
      if (time > futureLimit) {
        console.warn(`[p2p] reject ~h=${h + 1} time too far in future: ${time}`)
        return false
      }

      const target = bitsToTarget(nBits)
      if (target <= 0n || target > POW_LIMIT_TARGET) {
        console.warn(`[p2p] reject ~h=${h + 1} bad nBits=0x${nBits.toString(16)}`)
        return false
      }

      const hashHex = hashHeaderRaw(raw)
      if (BigInt('0x' + hashHex) > target) {
        console.warn(`[p2p] reject ~h=${h + 1} PoW fail hash=${hashHex.slice(0, 16)}`)
        return false
      }

      h++
      accepted.push({height: h, hash: hashHex, prevHash, time, nBits, raw})
      prevHash = hashHex
    }

    // Tip update first, append second (concurrency safety — see comment in
    // the original processHeaders for the 12× write-amplification bug this
    // fixes).
    this.chainTipHeight = h
    this.chainTipHash = prevHash

    const nextState: ChainTipState = {tipHeight: h, tipHash: prevHash}
    await this.chainStore.appendHeaders(accepted, nextState)

    // Don't reset the phase to 'syncing-headers' if a tip-follow batch
    // arrives after we've already announced 'synced' — that flips the phase
    // backward and confuses downstream consumers. We just emit progress.
    if (this.phase === 'syncing-headers' || this.phase === 'connecting') {
      this.emitStatus('syncing-headers')
    } else {
      // 'synced' or 'stopped' — re-emit current phase to push the new
      // tipHeight without changing phase.
      this.emitStatus(this.phase)
    }

    this.emit('chainExtended', accepted)
    return true
  }
}