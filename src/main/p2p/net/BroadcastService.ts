import {Peer, RejectInfo, TxBroadcast} from 'dash-core-p2p'
import {Transaction} from 'dash-core-sdk'
import {BROADCAST_POLICY} from '../constants'
import {PoolService} from './PoolService'
import {BroadcastPolicyOverrides, BroadcastResult} from '../types/broadcast'

// Policy layer over dash-core-p2p's TxBroadcast, which owns the wire protocol
// (inv, getdata, push, reject/islock watching).
//
// Runs on the lock pool (relay=true), so propagation back to us and the isdlock
// can both land here — but only while SyncService's watcher holds our txid,
// since a peer sends the lock object only in answer to a getdata for its inv.

function peerLabel(peer: Peer): string {
  return `${peer.host}:${peer.port}`
}

export class BroadcastService {
  constructor(private readonly peerPool: PoolService) {}

  broadcast = (txHex: string, overrides?: BroadcastPolicyOverrides): Promise<BroadcastResult> => {
    let tx: Transaction
    try {
      tx = Transaction.fromHex(txHex)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Promise.reject(new Error(`broadcast: failed to parse tx hex: ${message}`))
    }
    return this.run(tx, overrides)
  }

  private run(tx: Transaction, overrides?: BroadcastPolicyOverrides): Promise<BroadcastResult> {
    const {
      minPeerAcks, peerWaitMs, rebroadcastIntervalMs: rebroadcastMs, witnessPeers,
      maxRebroadcasts, unsolicitedPushAfterMs: unsolicitedAfterMs, failOnReject,
    } = BROADCAST_POLICY
    const waitForIs = overrides?.waitForInstantLock ?? BROADCAST_POLICY.waitForInstantLock
    const requireIs = overrides?.requireInstantLock ?? BROADCAST_POLICY.requireInstantLock
    const timeoutMs = overrides?.timeoutMs ?? BROADCAST_POLICY.timeoutMs

    const pool = this.peerPool.pool
    const session = new TxBroadcast(pool, tx)
    const startedAt = Date.now()

    return new Promise<BroadcastResult>((resolve, reject) => {
      let settled = false
      let rebroadcastsLeft = maxRebroadcasts
      const timers: ReturnType<typeof setTimeout>[] = []
      const intervals: ReturnType<typeof setInterval>[] = []
      const pushTimers = new Map<Peer, ReturnType<typeof setTimeout>>()
      let islockHex: string | null = null
      let lockedAt: number | null = null

      // Peers holding the tx. A peer that was handed the bytes has no reason
      // to getdata for them, so acks alone never reach minPeerAcks once the
      // unsolicited push has run — and in practice acks rarely arrive at all.
      const delivered = (): Set<Peer> => new Set([...session.requestedBy, ...session.txSentTo])

      const buildResult = (): BroadcastResult => ({
        txid: session.txid,
        peersInvited: session.invSentTo.size,
        peersAcked: [...session.requestedBy].map(peerLabel),
        peersDelivered: [...delivered()].map(peerLabel),
        peersPropagated: [...session.propagatedFrom].map(peerLabel),
        instantLocked: session.instantLocked,
        islockHex,
        lockLatencyMs: lockedAt == null ? null : lockedAt - startedAt,
        waitedForLock: waitForIs || requireIs,
        rejections: session.rejections.map(r => ({
          peer: peerLabel(r.peer),
          ccode: r.ccode,
          reason: r.reason,
        })),
        durationMs: Date.now() - startedAt,
      })

      const cleanup = (): void => {
        for (const t of timers) clearTimeout(t)
        for (const i of intervals) clearInterval(i)
        for (const t of pushTimers.values()) clearTimeout(t)
        pushTimers.clear()
        this.peerPool.off('peerready', onPeerReady)
        session.close()
      }

      const succeed = (): void => {
        if (settled) return
        settled = true
        cleanup()
        resolve(buildResult())
      }

      const fail = (msg: string): void => {
        if (settled) return
        settled = true
        cleanup()
        const err = new Error(msg) as Error & {result: BroadcastResult}
        err.result = buildResult()
        reject(err)
      }

      // A peer announcing our txid back proves the tx entered its mempool.
      // Delivery does not: it says the bytes left our socket, which a peer that
      // dropped the tx and a peer that accepted it produce alike.
      const spread = (): boolean => session.propagatedFrom.size > 0

      const checkDone = (): void => {
        if (settled) return
        if (requireIs) {
          if (session.instantLocked && spread()) succeed()
          return
        }
        // A lock settles it whatever the policy asked for — the tx is final, so
        // waiting on acks would learn nothing.
        if (session.instantLocked) {
          succeed()
          return
        }
        // A pinned peer set is normally too small to hold a witness back, and
        // Core never relays a tx toward the peer that announced it — so nothing
        // short of a lock can ever prove propagation here. Delivery is then the
        // only positive evidence there is.
        if (spread() || (this.peerPool.staticPeers && witnesses.size === 0 && delivered().size > 0)) succeed()
      }

      const armUnsolicited = (peer: Peer): void => {
        if (unsolicitedAfterMs <= 0) return
        if (pushTimers.has(peer)) return
        const t = setTimeout(() => {
          pushTimers.delete(peer)
          if (settled) return
          if (!session.requestedBy.has(peer) && !session.txSentTo.has(peer)) {
            session.push(peer)
          }
        }, unsolicitedAfterMs)
        pushTimers.set(peer, t)
      }

      // Held back for the life of the session: a witness that gets an inv from
      // us stops being able to answer the only question we have.
      const witnesses = new Set<Peer>()
      const reserveWitnesses = (): void => {
        if (witnesses.size > 0) return
        const ready = session.readyPeers()
        // Never at the cost of carrying the tx — below this the pool is too
        // small to both broadcast and observe, and only a lock can confirm.
        const spare = Math.min(witnessPeers, ready.length - minPeerAcks)
        if (spare <= 0) return
        for (const peer of ready.slice(-spare)) witnesses.add(peer)
      }

      const inviteNewPeers = (): number => {
        reserveWitnesses()
        const before = session.invSentTo.size
        const sent: Peer[] = []
        for (const peer of session.readyPeers()) {
          if (witnesses.has(peer)) continue
          sent.push(...session.announce(peer))
        }
        for (const p of sent) armUnsolicited(p)
        return sent.length || (session.invSentTo.size - before)
      }

      // Same lock under two names: current Dash Core serializes it as isdlock
      // (DIP-24), older peers as islock.
      const onLock = (msg: {getPayload?(): Uint8Array}): void => {
        if (lockedAt == null) {
          lockedAt = Date.now()
          const payload = msg.getPayload?.()
          if (payload) islockHex = Buffer.from(payload).toString('hex')
        }
        checkDone()
      }

      session.on('request', () => checkDone())
      session.on('sent', () => checkDone())
      session.on('propagated', () => checkDone())
      session.on('islock', onLock)
      session.on('isdlock', onLock)
      session.on('reject', (info: RejectInfo) => {
        if (failOnReject) {
          fail(`peer ${peerLabel(info.peer)} rejected tx (ccode=0x${info.ccode.toString(16)}: ${info.reason})`)
        }
      })

      const onPeerReady = (peer: Peer): void => {
        if (settled) return
        if (witnesses.has(peer)) return
        const sent = session.announce(peer)
        if (sent.length) armUnsolicited(peer)
        checkDone()
      }
      this.peerPool.on('peerready', onPeerReady)

      const initial = inviteNewPeers()

      if (initial === 0 && pool.numberConnected() === 0) {
        timers.push(
          setTimeout(() => {
            if (settled) return
            if (session.invSentTo.size === 0) {
              fail(`no ready peers within ${peerWaitMs}ms`)
            }
          }, peerWaitMs),
        )
      }

      timers.push(
        setTimeout(() => {
          if (settled) return
          const diagnostics =
            `invited=${session.invSentTo.size}, ack=${session.requestedBy.size}, ` +
            `delivered=${delivered().size}, propagated=${session.propagatedFrom.size}, ` +
            `witnesses=${witnesses.size}, islock=${session.instantLocked}`
          // Dash Core dropped BIP61 reject, so a peer that refuses the tx says
          // nothing. The evidence therefore has to be positive — a witness
          // announcing the txid back, or a lock — and neither arrived. The tx is
          // armed before broadcast, so a lock would already have settled this.
          if (witnesses.size === 0) {
            fail(`no peer to spare as a propagation witness, and no instant lock arrived (${diagnostics})`)
            return
          }
          fail(`no witness saw the tx enter a mempool within ${timeoutMs}ms (${diagnostics})`)
        }, timeoutMs),
      )

      if (rebroadcastMs > 0 && maxRebroadcasts > 0) {
        intervals.push(
          setInterval(() => {
            if (settled) return
            if (rebroadcastsLeft-- <= 0) return
            inviteNewPeers()
          }, rebroadcastMs),
        )
      }

      checkDone()
    })
  }
}
