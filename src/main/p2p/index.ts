import {SyncService} from './SyncService'
import {P2PCommand, P2PEvent} from './types/messages'

process.title = 'dash-p2p'

// Diagnostic: surface anything that would otherwise silently kill the
// utility process. Without these the parent only sees `exit code=1`
// with no clue about the cause. We log (captured by the parent's stderr
// tail) AND forward to the parent as an `error` event so the cause is
// recorded centrally even when no one is watching the terminal.
function reportFatal(label: string, value: unknown): void {
  const detail = value instanceof Error ? (value.stack ?? value.message) : String(value)
  console.error(`[p2p] ${label}:`, value)
  try {
    process.parentPort.postMessage({type: 'error', message: `${label}: ${detail}`})
  } catch {
    // parentPort may already be torn down during shutdown — the console.error above still lands.
  }
}
process.on('uncaughtException', (err) => {
  reportFatal('uncaughtException', err)
})
process.on('unhandledRejection', (reason) => {
  reportFatal('unhandledRejection', reason)
})

// Utility-process entry. Pure IPC adapter — every concern (chain.db,
// peer pool, header/cfilter workers, status aggregation) lives in
// SyncService and below. This file exists only to bridge parentPort
// messages to/from SyncService method calls.

declare const process: NodeJS.Process & {
  parentPort: {
    on: (event: 'message', listener: (msg: { data: P2PCommand }) => void) => void
    postMessage: (msg: P2PEvent) => void
  }
}

const sync = new SyncService({
  status: status => process.parentPort.postMessage({type: 'status', status}),
  blockApplied: block => process.parentPort.postMessage({type: 'blockApplied', block}),
  cursorAdvanced: (walletId, height) =>
    process.parentPort.postMessage({type: 'cursorAdvanced', walletId, height}),
  error: message => process.parentPort.postMessage({type: 'error', message}),
  broadcastResult: (requestId, ok, result, errorMessage) =>
    process.parentPort.postMessage({type: 'broadcastResult', requestId, ok, result, errorMessage}),
  txInstantLocked: (walletId, txid) =>
    process.parentPort.postMessage({type: 'txInstantLocked', walletId, txid}),
  chainLocked: (walletId, height) =>
    process.parentPort.postMessage({type: 'chainLocked', walletId, height}),
})

process.parentPort.on('message', ({data}) => {
  switch (data.type) {
    case 'start':
      console.log(data)
      sync.start(data).catch(err => {
        const message = err instanceof Error ? err.message : String(err)
        process.parentPort.postMessage({type: 'error', message})
      })
      return
    case 'stop':
      console.log(data)
      sync.stop().catch(err => {
        const message = err instanceof Error ? err.message : String(err)
        process.parentPort.postMessage({type: 'error', message})
      })
      return
    case 'addWatchAddresses':
      sync.addWatchAddresses(data)
      return
    case 'broadcast':
      sync.broadcast(data)
      return
    case 'watchTxs':
      sync.watchTxs(data)
      return
  }
})

// Push the initial 'idle' state to the parent.
process.parentPort.postMessage({type: 'status', status: sync.getStatus()})

// Periodic resident-memory log so the p2p footprint can be tracked over a
// sync run without an external profiler. RSS is the number that shows up in
// Activity Monitor / Task Manager for the dash-p2p process.
const MB = 1024 * 1024
setInterval(() => {
  const m = process.memoryUsage()
  console.log(
    `[p2p-mem] rss=${(m.rss / MB).toFixed(0)}MB heapUsed=${(m.heapUsed / MB).toFixed(0)}MB ` +
    `heapTotal=${(m.heapTotal / MB).toFixed(0)}MB external=${(m.external / MB).toFixed(0)}MB ` +
    `arrayBuffers=${(m.arrayBuffers / MB).toFixed(0)}MB`,
  )
}, 60_000).unref()
