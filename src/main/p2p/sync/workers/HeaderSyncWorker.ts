import {Inventory, Message, Peer} from 'dash-core-p2p'
import {ChainStore} from '../../store/ChainStore'
import {PoolService} from '../../net/PoolService'
import {buildLocatorHeights} from '../../utils/blockLocator'
import {displayHexToWire, wireToDisplayHex} from '../../utils/byteOrder'
import {ChainWindow} from '../../store/chainWindow'
import {formatChainDbError} from '../../store/chainDbError'
import {validateHeaders} from '../../utils/headerValidation'
import {PeerRotation} from '../../net/peerRotation'
import {headerWork, rawPrevHash} from '../../utils/pow'
import {Worker} from './Worker'
import {
  ANNOUNCE_DEDUPE_LIMIT,
  HEADER_RACE_PEERS,
  HEADER_STALL_CHECK_MS,
  HEADER_STALL_TIMEOUT_MS,
  HEADER_SYNC_TIMEOUT_MS,
  INV_TYPE_NAMES,
  REORG_MAX_DEPTH,
} from '../../constants'
import type {
  HeaderRace,
  HeaderSyncPhase,
  HeaderSyncWorkerOptions,
  HeaderSyncWorkerStatus,
} from '../../types/headerSync'
import {PersistedHeader, ChainTipState} from '../../types/chainStore'

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
  private finalityHeight: number

  private readonly window: ChainWindow
  private readonly rotation: PeerRotation

  private currentRace: HeaderRace | null = null
  private phase: HeaderSyncPhase = 'connecting'
  private stopped = false

  // Chased announcements, so one block costs one getheaders across all peers.
  private announcedBlocks = new Set<string>()
  // Non-tx inv hashes already logged. Every peer announces the same clsig —
  // measured at ~11 copies — and one line each buries the rest of the log.
  private loggedInv = new Set<string>()
  private lastHeaderAt = Date.now()
  private lastStallPollAt = 0
  private stallTimer: ReturnType<typeof setInterval> | null = null

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
    this.finalityHeight = opts.finalityHeight
    this.window = new ChainWindow(opts.initialTipHeight)
    this.rotation = new PeerRotation(() => this.peerPool.readyPeers)
  }

  // ChainLocks arrive on the lock pool, which outlives this worker, so the
  // floor moves under us rather than being fixed at construction.
  setFinalityHeight = (height: number): void => {
    if (height > this.finalityHeight) this.finalityHeight = height
  }

  start = async (): Promise<void> => {
    await this.window.load(this.chainStore, this.chainTipHash)
    this.peerPool.on('peerready', this.onPeerReady)
    this.peerPool.on('peerheaders', this.onPeerHeaders)
    this.peerPool.on('peerinv', this.onPeerInv)
    this.peerPool.on('peerdisconnect', this.onPeerDisconnect)
    this.emitStatus('connecting')

    this.lastHeaderAt = Date.now()
    this.stallTimer = setInterval(() => this.checkForStall(), HEADER_STALL_CHECK_MS)
    this.stallTimer.unref?.()

    // Any peers already ready when we attached should kick off the race.
    for (const peer of this.peerPool.readyPeers) this.handlePeerReady(peer)
  }

  stop = (): void => {
    if (this.stopped) return
    this.stopped = true
    if (this.currentRace?.timer) clearTimeout(this.currentRace.timer)
    this.currentRace = null
    if (this.stallTimer) clearInterval(this.stallTimer)
    this.stallTimer = null
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
      return
    }

    // A fresh peer arriving while the tip is stale is the pool having replaced
    // peers that died with the link. Without this the tip waits out the rest of
    // HEADER_STALL_TIMEOUT_MS before anyone is asked again.
    if (this.phase === 'synced' && Date.now() - this.lastHeaderAt > HEADER_STALL_CHECK_MS) {
      this.requestTipHeaders([peer])
    }
  }

  private handlePeerInv(peer: Peer, inventory: Array<{ type: number; hash?: Uint8Array }>): void {
    this.chaseAnnouncedBlocks(peer, inventory)

    const counts: Record<number, number> = {}
    for (const item of inventory) counts[item.type] = (counts[item.type] ?? 0) + 1
    // With relay on, peers stream mempool tx inv continuously and none of it
    // matters here (SyncService owns lock inv), so only log batches carrying
    // something else.
    const interesting = Object.keys(counts).some(t => Number(t) !== 1 && Number(t) !== 16)
    if (!interesting) return
    // Display order, so the line correlates with the lock watcher's logs.
    const fresh = inventory
      .filter(i => i.type !== 1 && i.type !== 16 && i.hash)
      .map(i => `${typeName(i.type)}:${wireToDisplayHex(i.hash!)}`)
      .filter(entry => !this.loggedInv.has(entry))
    if (fresh.length === 0) return
    if (this.loggedInv.size >= ANNOUNCE_DEDUPE_LIMIT) this.loggedInv.clear()
    for (const entry of fresh) this.loggedInv.add(entry)
    const summary = Object.entries(counts).map(([t, n]) => `${typeName(Number(t))}=${n}`).join(' ')
    console.log(`[p2p] peerinv from ${peer.host} ${summary || '(empty)'} [${fresh.join(' ')}]`)
  }

  // Past 'synced' the tip rides on unsolicited pushes, which need a peer that
  // honours sendheaders. An inv announcement is the only other signal we are behind.
  private chaseAnnouncedBlocks(peer: Peer, inventory: Array<{ type: number; hash?: Uint8Array }>): void {
    if (this.stopped || this.phase !== 'synced') return

    let chase = false
    for (const item of inventory) {
      if (item.type !== Inventory.TYPE.BLOCK || !item.hash) continue
      const hash = wireToDisplayHex(item.hash)
      // Already ours, or already chased by another peer's announcement.
      if (this.window.has(hash) || this.announcedBlocks.has(hash)) continue
      if (this.announcedBlocks.size >= ANNOUNCE_DEDUPE_LIMIT) this.announcedBlocks.clear()
      this.announcedBlocks.add(hash)
      chase = true
    }

    if (!chase) return
    console.log(`[p2p] block announced by ${peer.host} above h=${this.chainTipHeight} — requesting headers`)
    this.requestTipHeaders([peer])
  }

  private requestTipHeaders(peers: Peer[]): void {
    if (peers.length === 0) return
    const msg = this.getHeadersMsg(this.buildLocator())
    for (const peer of peers) peer.sendMessage(msg)
  }

  // Backstop for the inv path: a peer set sending neither headers nor
  // announcements freezes the tip while status still reads 'synced'.
  private checkForStall(): void {
    if (this.stopped || this.phase !== 'synced') return

    const quietSince = Math.max(this.lastHeaderAt, this.lastStallPollAt)
    if (Date.now() - quietSince < HEADER_STALL_TIMEOUT_MS) return

    const peers = [...this.peerPool.readyPeers].slice(0, HEADER_RACE_PEERS)
    if (peers.length === 0) return

    this.lastStallPollAt = Date.now()
    const quietFor = Math.round((Date.now() - this.lastHeaderAt) / 1000)
    console.warn(`[p2p] no headers for ${quietFor}s at h=${this.chainTipHeight} — polling ${peers.length} peer(s)`)
    this.requestTipHeaders(peers)
  }

  private handlePeerHeaders(peer: Peer, rawHeaders: Uint8Array[]): void {
    if (this.stopped) return
    this.rotation.markResponsive(peer)

    if (this.phase !== 'syncing-headers') {
      // Tip-following: post-sync, accept unsolicited extensions and the
      // competing branches processHeaders resolves against our own.
      if (rawHeaders.length === 0 || rawHeaders[0]!.length < 80) return
      this.processHeaders(rawHeaders, peer.host).catch(err => {
        console.error('[p2p] processHeaders (tip-follow) failed:', err)
        this.reportError(formatChainDbError(err), false)
      })
      return
    }

    const race = this.currentRace
    if (!race || !race.racers.has(peer)) return

    // A batch that does not build on the tip this race asked from is the answer
    // to an earlier race, still in flight — the same peers are picked race after
    // race. Crediting it here consumes the racer and rejects the batch, and the
    // peer's real answer is then dropped for not being in `racers`, so the race
    // waits on whoever is left. Measured at 97% of first responses.
    if (rawHeaders.length > 0 && rawHeaders[0]!.length >= 80 &&
        rawPrevHash(rawHeaders[0]!) !== race.expectedPrev) {
      return
    }

    // Unconditional past that point: a racer left in the set on an unusable
    // response holds the race open until its timeout, re-asking the same peers
    // the same question.
    race.racers.delete(peer)

    if (rawHeaders.length > 0 && rawHeaders[0]!.length < 80) {
      this.restartIfExhausted(race)
      return
    }

    if (rawHeaders.length === 0) {
      race.zeroResponses++
      const agreeThreshold = Math.min(2, Math.max(1, this.peerPool.readyPeers.size))
      if (race.zeroResponses >= agreeThreshold) {
        this.finishHeaderSync()
      } else {
        this.restartIfExhausted(race)
      }
      return
    }

    this.processHeaders(rawHeaders, peer.host).then(advanced => {
      if (this.stopped) return
      if (!advanced) {
        // zeroResponses left alone: those peers are counting toward
        // finishHeaderSync, and restarting would re-ask them the same thing.
        if (race.zeroResponses === 0) this.restartIfExhausted(race)
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
    this.rotation.forget(peer)
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

  private getHeadersMsg(locator: string[]): Message {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.peerPool.messages as any).GetHeaders({
      starts: locator.map(displayHexToWire),
      stop: new Uint8Array(32),
    })
  }

  private buildLocator(): string[] {
    const hashes: string[] = []
    for (const height of buildLocatorHeights(this.chainTipHeight, this.window.floor(this.finalityHeight))) {
      const hash = this.window.hashAt(height)
      if (hash) hashes.push(hash)
    }
    // Nothing loaded yet (fresh chain.db at genesis) — the tip still locates us.
    return hashes.length > 0 ? hashes : [this.chainTipHash]
  }

  private startHeaderRace(): void {
    if (this.stopped || this.peerPool.readyPeers.size === 0 || this.currentRace) return

    const picks = this.rotation.pick(HEADER_RACE_PEERS)
    if (picks.length === 0) return

    const locator = this.buildLocator()
    const race: HeaderRace = {
      locator, expectedPrev: this.chainTipHash, racers: new Set(picks), zeroResponses: 0, timer: null,
    }
    this.currentRace = race

    const msg = this.getHeadersMsg(locator)
    for (const p of picks) p.sendMessage(msg)
    console.log(`[p2p] race start locator=${locator[0]}+${locator.length - 1} height=${this.chainTipHeight} racers=${picks.length}`)

    race.timer = setTimeout(() => {
      if (this.currentRace !== race) return
      console.warn(`[p2p] race at ${locator} timed out (silent: ${race.racers.size})`)
      // Whoever is still outstanding never answered, so the next race prefers
      // anyone else.
      this.rotation.markSilent(race.racers)
      this.endRace(race)
      this.startHeaderRace()
    }, HEADER_SYNC_TIMEOUT_MS)
  }

  // The last outstanding racer answered with nothing usable. Without this the
  // race holds until HEADER_SYNC_TIMEOUT_MS before anyone else is asked.
  private restartIfExhausted(race: HeaderRace): void {
    if (race.racers.size > 0) return
    this.endRace(race)
    this.startHeaderRace()
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

  private async processHeaders(rawHeaders: Uint8Array[], from: string): Promise<boolean> {
    if (rawHeaders.length === 0) return false

    const incomingPrev = rawPrevHash(rawHeaders[0]!)
    if (incomingPrev === this.chainTipHash) {
      const validated = validateHeaders(rawHeaders, this.chainTipHeight, this.chainTipHash)
      return validated == null ? false : await this.commitHeaders(validated.accepted, from)
    }

    // Usually not a competing branch: a second peer announcing the block we just
    // accepted lands here too, its parent now one below the tip.
    const connectsAt = this.window.heightOf(incomingPrev)
    if (connectsAt == null) {
      console.warn(`[p2p] reject batch: prev=${incomingPrev} is neither our tip nor within the last ${REORG_MAX_DEPTH} blocks`)
      return false
    }

    const {rest, height, hash} = this.window.trimKnownPrefix(rawHeaders, connectsAt, incomingPrev)
    if (rest.length === 0) return false
    if (height === this.chainTipHeight) {
      const validated = validateHeaders(rest, this.chainTipHeight, this.chainTipHash)
      return validated == null ? false : await this.commitHeaders(validated.accepted, from)
    }
    return await this.considerFork(rest, height, hash, from)
  }

  private async considerFork(rawHeaders: Uint8Array[], forkHeight: number, forkHash: string, from: string): Promise<boolean> {
    // A ChainLock is final by consensus, so a branch forking under one is not a
    // chain we lost — it is a peer on a chain that lost.
    if (forkHeight < this.finalityHeight) {
      console.warn(`[p2p] refusing fork at h=${forkHeight}: below chainlocked h=${this.finalityHeight}`)
      return false
    }

    const validated = validateHeaders(rawHeaders, forkHeight, forkHash)
    if (validated == null) return false

    const ourWork = this.window.workAbove(forkHeight)
    if (validated.work <= ourWork) {
      console.log(`[p2p] fork at h=${forkHeight} carries no more work than ours — keeping current branch`)
      return false
    }

    await this.rewindTo(forkHeight, forkHash)
    return await this.commitHeaders(validated.accepted, from)
  }

  private async rewindTo(forkHeight: number, forkHash: string): Promise<void> {
    console.warn(`[p2p] reorg: dropping ${this.chainTipHeight - forkHeight} block(s) back to h=${forkHeight} ${forkHash}`)
    await this.chainStore.deleteHeadersFrom(forkHeight + 1, {tipHeight: forkHeight, tipHash: forkHash})

    this.chainTipHeight = forkHeight
    this.chainTipHash = forkHash
    this.window.setTip(forkHeight)
    this.window.prune()

    // Ordered before the winning branch's chainExtended so the filter scan and
    // SQL have dropped the orphaned blocks by the time replacements arrive.
    this.emit('chainRewound', forkHeight)
  }

  private async commitHeaders(accepted: PersistedHeader[], from: string): Promise<boolean> {
    const last = accepted[accepted.length - 1]!

    // Advance the in-memory tip BEFORE awaiting the write: racing peers re-enter
    // processHeaders during the await and, against the old tip, all pass
    // validation and queue duplicate batches (~12x write amplification).
    this.chainTipHeight = last.height
    this.chainTipHash = last.hash
    this.window.setTip(last.height)
    for (const header of accepted) this.window.record(header.height, header.hash, headerWork(header.nBits))

    this.lastHeaderAt = Date.now()
    console.log(`[p2p] tip h=${last.height} +${accepted.length} from ${from} phase=${this.phase}`)
    // Whatever was outstanding is either in the window now or was never ours.
    this.announcedBlocks.clear()

    const nextState: ChainTipState = {tipHeight: last.height, tipHash: last.hash}
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