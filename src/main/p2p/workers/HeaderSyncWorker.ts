import {Message, Peer} from 'dash-core-p2p'
import {utils as coreUtils} from 'dash-core-sdk'
import {ChainStore} from '../ChainStore'
import {PoolService} from '../PoolService'
import {bitsToTarget, hashHeaderRaw, POW_LIMIT_TARGET, rawPrevHash} from '../pow'
import {Worker} from './Worker'
import {
  HEADER_RACE_PEERS,
  HEADER_SYNC_TIMEOUT_MS,
  INV_TYPE_NAMES,
  MAX_FUTURE_BLOCK_TIME,
} from '../constants'
import type {
  HeaderRace,
  HeaderSyncPhase,
  HeaderSyncWorkerOptions,
  HeaderSyncWorkerStatus,
} from '../types/headerSync'
import {PersistedHeader, ChainTipState} from '../types/chainStore'

function typeName(t: number): string {
  return INV_TYPE_NAMES[t] ?? `UNKNOWN(${t})`
}

// Races `getheaders` against ready peers, validates PoW only (DGWv3 difficulty
// is deliberately off — see processHeaders), and persists via ChainStore.
// 'chainExtended' is what CFilterSyncWorker follows to keep its in-memory chain
// index current for live tip following.
export class HeaderSyncWorker extends Worker {
  readonly name = 'HeaderSyncWorker'

  private chainStore: ChainStore
  private peerPool: PoolService

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

  private handlePeerInv(peer: Peer, inventory: Array<{ type: number; hash?: Uint8Array }>): void {
    const counts: Record<number, number> = {}
    for (const item of inventory) counts[item.type] = (counts[item.type] ?? 0) + 1
    // With relay on, peers stream mempool tx inv continuously and none of it
    // matters here (SyncService owns lock inv), so only log batches carrying
    // something else.
    const interesting = Object.keys(counts).some(t => Number(t) !== 1 && Number(t) !== 16)
    if (!interesting) return
    const summary = Object.entries(counts).map(([t, n]) => `${typeName(Number(t))}=${n}`).join(' ')
    // Display order, so the line correlates with the lock watcher's logs.
    const hashes = inventory
      .filter(i => i.type !== 1 && i.type !== 16 && i.hash)
      .map(i => `${typeName(i.type)}:${Buffer.from(i.hash!).reverse().toString('hex')}`)
      .join(' ')
    console.log(`[p2p] peerinv from ${peer.host} ${summary || '(empty)'}${hashes ? ` [${hashes}]` : ''}`)
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
        this.reportError(formatChainDbError(err), false)
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
      this.reportError(formatChainDbError(err), false)
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

  // DGWv3 difficulty validation is intentionally off: replicating Dash
  // testnet's early-chain edge cases (min-difficulty rule, encoded POW_LIMIT
  // round-tripping) is out of scope until a recent checkpoint anchors trust.
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

    // Advance the in-memory tip BEFORE awaiting the write: racing peers
    // re-enter processHeaders during the await, and against the old tip they
    // all pass validation and queue duplicate batches (12x write
    // amplification). Updating first makes the prev-hash check reject them
    // synchronously.
    this.chainTipHeight = h
    this.chainTipHash = prevHash

    const nextState: ChainTipState = {tipHeight: h, tipHash: prevHash}
    await this.chainStore.appendHeaders(accepted, nextState)

    // A tip-follow batch arriving after 'synced' must not flip the phase
    // backward, so past that point we re-emit the current phase to push
    // tipHeight and nothing else.
    if (this.phase === 'syncing-headers' || this.phase === 'connecting') {
      this.emitStatus('syncing-headers')
    } else {
      this.emitStatus(this.phase)
    }

    this.emit('chainExtended', accepted)
    return true
  }
}

// The LevelDB code has to reach the message text — that string is what
// SyncService.isFatalChainDbError matches on to decide to tear down.
function formatChainDbError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const code = (err as { code?: string }).code
  return code ? `${code}: ${message}` : message
}