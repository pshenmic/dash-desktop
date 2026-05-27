import {Peer, RejectInfo, TxBroadcast} from 'dash-core-p2p'
import {Transaction} from 'dash-core-sdk'
import {BROADCAST_POLICY} from './constants'
import {PoolService} from './PoolService'
import {BroadcastResult} from './types/broadcast'

// Policy-level wallet broadcaster. The wire protocol — inv, getdata, push,
// reject/islock watching — lives in dash-core-p2p's TxBroadcast. This
// service composes those primitives into a single broadcast() call with
// timeout, minimum-ack and rebroadcast behavior.
//
// The shared PoolService passed in is the same pool used by header / cfilter sync —
// broadcast piggy-backs on whatever peer connections are already open.
// The pool runs with relay=false, so peer-side propagation back to us
// (`propagated`) will not fire; we rely on inv→getdata acks (`request`).
//
// All policy values are hardcoded in constants — callers pass only the
// signed tx hex.

function peerLabel(peer: Peer): string {
  return `${peer.host}:${peer.port}`
}

export class BroadcastService {
  constructor(private readonly peerPool: PoolService) {}

  broadcast = (txHex: string): Promise<BroadcastResult> => {
    let tx: Transaction
    try {
      tx = Transaction.fromHex(txHex)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Promise.reject(new Error(`broadcast: failed to parse tx hex: ${message}`))
    }
    return this.run(tx)
  }

  private run(tx: Transaction): Promise<BroadcastResult> {
    const {
      minPeerAcks, waitForInstantLock: waitForIs, requireInstantLock: requireIs,
      peerWaitMs, timeoutMs, rebroadcastIntervalMs: rebroadcastMs,
      maxRebroadcasts, unsolicitedPushAfterMs: unsolicitedAfterMs, failOnReject,
    } = BROADCAST_POLICY

    const pool = this.peerPool.pool
    // dash-core-p2p ships its own pinned copy of dash-core-sdk under
    // node_modules/dash-core-p2p/node_modules/dash-core-sdk, so its
    // TxBroadcast signature wants a Transaction from a structurally
    // identical but nominally distinct class. Bridge across the
    // duplicated type with an unknown cast.
    const session = new TxBroadcast(pool, tx as unknown as ConstructorParameters<typeof TxBroadcast>[1])
    const startedAt = Date.now()

    return new Promise<BroadcastResult>((resolve, reject) => {
      let settled = false
      let rebroadcastsLeft = maxRebroadcasts
      const timers: ReturnType<typeof setTimeout>[] = []
      const intervals: ReturnType<typeof setInterval>[] = []
      const pushTimers = new Map<Peer, ReturnType<typeof setTimeout>>()

      const buildResult = (): BroadcastResult => ({
        txid: session.txid,
        peersInvited: session.invSentTo.size,
        peersAcked: [...session.requestedBy].map(peerLabel),
        peersPropagated: [...session.propagatedFrom].map(peerLabel),
        instantLocked: session.instantLocked,
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

      const checkDone = (): void => {
        if (settled) return
        if (requireIs) {
          if (session.instantLocked && session.requestedBy.size >= minPeerAcks) succeed()
          return
        }
        if (session.instantLocked && waitForIs) {
          succeed()
          return
        }
        if (session.requestedBy.size >= minPeerAcks && !waitForIs) {
          succeed()
          return
        }
        if (session.requestedBy.size >= minPeerAcks && waitForIs && !requireIs) {
          succeed()
        }
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

      session.on('request', () => checkDone())
      session.on('islock', () => checkDone())
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
          fail(
            `timed out after ${timeoutMs}ms ` +
            `(invited=${session.invSentTo.size}, ack=${session.requestedBy.size}, ` +
            `islock=${session.instantLocked})`,
          )
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
