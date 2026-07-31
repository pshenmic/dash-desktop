import {Peer, RejectInfo, TxBroadcast} from 'dash-core-p2p'
import {Transaction} from 'dash-core-sdk'
import {BROADCAST_POLICY} from './constants'
import {PoolService} from './PoolService'
import {BroadcastPolicyOverrides, BroadcastResult} from './types/broadcast'

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
      minPeerAcks, peerWaitMs, rebroadcastIntervalMs: rebroadcastMs,
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

      // A peer announcing our txid back to us proves the tx entered its
      // mempool, which is stronger evidence than either an ack or our own
      // write returning.
      const spread = (): boolean =>
        session.propagatedFrom.size > 0 || delivered().size >= minPeerAcks

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
        if (spread()) succeed()
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

      const inviteNewPeers = (): number => {
        const before = session.invSentTo.size
        const sent = session.announce()
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
            `islock=${session.instantLocked}`
          // Dash Core dropped BIP61 reject, so silence is not failure: once the
          // bytes reached a peer the tx is on the network. Only a caller that
          // demanded a lock may treat this as an error.
          if (delivered().size > 0 && !requireIs) {
            console.log(`[broadcast] ${session.txid} settling on delivery without ack (${diagnostics})`)
            succeed()
            return
          }
          fail(`timed out after ${timeoutMs}ms (${diagnostics})`)
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
