import {Message, Messages, Peer, Pool} from 'dash-core-p2p'
import {utils as coreUtils} from 'dash-core-sdk'
import {Network} from '../src/types'
import {ChainDAO, ChainTipState, PersistedHeader} from './ChainDAO'
import {
  bitsToTarget,
  hashHeaderRaw,
  MAX_FUTURE_BLOCK_TIME,
  POW_LIMIT_TARGET,
  rawPrevHash,
} from './pow'

const HEADER_SYNC_TIMEOUT_MS = 30_000
const HEADER_RACE_PEERS = 12
const REFILL_INTERVAL_MS = 5_000

const INV_TYPE_NAMES: Record<number, string> = {
  0: 'ERROR', 1: 'TX', 2: 'BLOCK', 3: 'FILTERED_BLOCK',
  16: 'DSTX', 29: 'CLSIG', 30: 'ISLOCK', 31: 'ISDLOCK',
}

function typeName(t: number): string {
  return INV_TYPE_NAMES[t] ?? `UNKNOWN(${t})`
}

export type SyncPhase = 'connecting' | 'syncing-headers' | 'synced' | 'stopped'

export interface HeaderSyncStatus {
  phase: SyncPhase
  tipHeight: number
  tipHash: string | null
  peerCount: number
}

export interface HeaderSyncOptions {
  network: Network
  chainDAO: ChainDAO
  initialTipHeight: number
  initialTipHash: string
  emit: (status: HeaderSyncStatus) => void
}

interface HeaderRace {
  locator: string
  racers: Set<Peer>
  zeroResponses: number
  timer: ReturnType<typeof setTimeout> | null
}

export class HeaderSync {
  private network: Network
  private chainDAO: ChainDAO
  private emitStatus: (status: HeaderSyncStatus) => void

  private chainTipHeight: number
  private chainTipHash: string

  private pool: Pool
  private messages: Messages
  private readyPeers = new Set<Peer>()
  private currentRace: HeaderRace | null = null
  private phase: SyncPhase = 'connecting'
  private stopped = false
  private refillTimer: ReturnType<typeof setInterval> | null = null

  constructor(opts: HeaderSyncOptions) {
    this.network = opts.network
    this.chainDAO = opts.chainDAO
    this.emitStatus = opts.emit
    this.chainTipHeight = opts.initialTipHeight
    this.chainTipHash = opts.initialTipHash

    this.messages = new Messages({network: this.network} as any)
    this.pool = new Pool({network: this.network, maxSize: 32, relay: false, messages: this.messages})

    this.bindHandlers()
  }

  start = (): void => {
    this.emit('connecting')
    this.pool.connect()
    this.refillTimer = setInterval(() => {
      if (this.stopped) return
      if (this.readyPeers.size < HEADER_RACE_PEERS) {
        const before = this.pool.numberConnected()
        ;(this.pool as any)._fillConnections()
        const after = this.pool.numberConnected()
        if (after > before) console.log(`[spv] refill connected=${before}->${after} ready=${this.readyPeers.size} addrs=${(this.pool as any)._addrs?.length ?? '?'}`)
      }
    }, REFILL_INTERVAL_MS)
    this.refillTimer.unref?.()
  }

  stop = (): void => {
    if (this.stopped) return
    this.stopped = true
    if (this.refillTimer) { clearInterval(this.refillTimer); this.refillTimer = null }
    if (this.currentRace?.timer) clearTimeout(this.currentRace.timer)
    this.currentRace = null
    this.pool.disconnect()
    this.phase = 'stopped'
    this.emit('stopped')
  }

  private emit(phase: SyncPhase): void {
    this.phase = phase
    this.emitStatus({
      phase,
      tipHeight: this.chainTipHeight,
      tipHash: this.chainTipHash || null,
      peerCount: this.readyPeers.size,
    })
  }

  private bindHandlers(): void {
    this.pool.on('peerconnect', (peer: Peer) => {
      console.log(`[spv] peerconnect ${peer.host}:${peer.port}`)
    })


    // Detailed inv logging: if peers are replying to getheaders with `inv`
    // of BLOCK hashes (legacy getblocks-style behavior), we'll see TYPE=2
    // entries here.
    this.pool.on('peerinv', (peer: Peer, msg: { inventory?: Array<{ type: number }> }) => {
      const counts: Record<number, number> = {}
      for (const item of msg.inventory ?? []) counts[item.type] = (counts[item.type] ?? 0) + 1
      const summary = Object.entries(counts).map(([t, n]) => `${typeName(Number(t))}=${n}`).join(' ')
      console.log(`[spv] peerinv from ${peer.host} ${summary || '(empty)'}`)
    })

    this.pool.on('peerready', (peer: Peer) => {
      if (this.stopped) return
      this.readyPeers.add(peer)
      console.log(`[spv] peerready ${peer.host}:${peer.port} v${peer.version} bestHeight=${peer.bestHeight} ready=${this.readyPeers.size}`)
      peer.sendMessage((this.messages as any).SendHeaders())

      if (this.phase === 'connecting' || this.phase === 'syncing-headers') {
        if (this.phase === 'connecting') this.emit('syncing-headers')
        if (!this.currentRace) {
          this.startHeaderRace()
        } else if (this.currentRace.racers.size < HEADER_RACE_PEERS) {
          this.currentRace.racers.add(peer)
          peer.sendMessage(this.getHeadersMsg(this.currentRace.locator))
        }
      }
    })

    this.pool.on('peerheaders', (peer: Peer, message: { headers?: Uint8Array[] }) => {
      if (this.stopped) return
      const rawHeaders = message.headers ?? []
      console.log(`[spv] peerheaders ${peer.host} count=${rawHeaders.length} phase=${this.phase}`)

      if (this.phase !== 'syncing-headers') {
        // Tip-following: post-sync, accept unsolicited extension of the chain.
        if (rawHeaders.length === 0 || rawHeaders[0]!.length < 80) return
        if (rawPrevHash(rawHeaders[0]!) !== this.chainTipHash) return
        this.processHeaders(rawHeaders).catch(err => {
          console.error('[spv] processHeaders (tip-follow) failed:', err)
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
        const agreeThreshold = Math.min(2, Math.max(1, this.readyPeers.size))
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
        console.error('[spv] processHeaders failed:', err)
        this.endRace(race)
        if (this.phase === 'syncing-headers') this.startHeaderRace()
      })
    })

    this.pool.on('peerdisconnect', (peer: Peer) => {
      this.readyPeers.delete(peer)
      console.log(`[spv] peerdisconnect ${peer.host}:${peer.port} ready=${this.readyPeers.size}`)
      const race = this.currentRace
      if (race && race.racers.has(peer)) {
        race.racers.delete(peer)
        if (race.racers.size === 0) {
          this.endRace(race)
          if (this.phase === 'syncing-headers') this.startHeaderRace()
        }
      }
    })

    this.pool.on('seederror', (err: Error) => {
      console.error('[spv] seed error:', err.message)
    })
  }

  private getHeadersMsg(locator: string): Message {
    return (this.messages as any).GetHeaders({
      starts: [coreUtils.hexToBytes(locator).reverse()],
      stop: new Uint8Array(32),
    })
  }

  private startHeaderRace(): void {
    if (this.stopped || this.readyPeers.size === 0 || this.currentRace) return

    const picks: Peer[] = []
    for (const p of this.readyPeers) {
      picks.push(p)
      if (picks.length >= HEADER_RACE_PEERS) break
    }
    if (picks.length === 0) return

    const locator = this.chainTipHash
    const race: HeaderRace = {locator, racers: new Set(picks), zeroResponses: 0, timer: null}
    this.currentRace = race

    const msg = this.getHeadersMsg(locator)
    for (const p of picks) p.sendMessage(msg)
    console.log(`[spv] race start locator=${locator} height=${this.chainTipHeight} racers=${picks.length}`)

    race.timer = setTimeout(() => {
      if (this.currentRace !== race) return
      console.warn(`[spv] race at ${locator} timed out`)
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
    this.emit('synced')
  }

  // Validate a batch of raw 80-byte headers against the current tip. On
  // success persists them and advances tip. Returns true if any header
  // was accepted.
  //
  // DGWv3 difficulty validation is intentionally disabled: replicating
  // Dash testnet's early-chain edge cases (min-difficulty rule, encoded
  // POW_LIMIT round-tripping) is out of scope for now. Re-enable once we
  // have a recent checkpoint as the trust anchor or a reference DGW impl
  // matched against the live chain.
  private async processHeaders(rawHeaders: Uint8Array[]): Promise<boolean> {
    console.log(`[spv] processHeaders: ${rawHeaders.length}`)
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
        console.warn(`[spv] reject ~h=${h + 1} prev mismatch got=${incomingPrev.slice(0, 16)} want=${prevHash.slice(0, 16)}`)
        return false
      }
      if (time > futureLimit) {
        console.warn(`[spv] reject ~h=${h + 1} time too far in future: ${time}`)
        return false
      }

      const target = bitsToTarget(nBits)
      if (target <= 0n || target > POW_LIMIT_TARGET) {
        console.warn(`[spv] reject ~h=${h + 1} bad nBits=0x${nBits.toString(16)}`)
        return false
      }

      const hashHex = hashHeaderRaw(raw)
      if (BigInt('0x' + hashHex) > target) {
        console.warn(`[spv] reject ~h=${h + 1} PoW fail hash=${hashHex.slice(0, 16)}`)
        return false
      }

      h++
      accepted.push({height: h, hash: hashHex, prevHash, time, nBits, raw})
      prevHash = hashHex
    }

    const nextState: ChainTipState = {
      tipHeight: h,
      tipHash: prevHash,
    }
    await this.chainDAO.appendHeaders(this.network, accepted, nextState)

    this.chainTipHeight = h
    this.chainTipHash = prevHash

    this.emit('syncing-headers')
    return true
  }
}
