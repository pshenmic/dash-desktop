import {SyncService} from './SyncService'
import {P2PCommand, P2PEvent} from './types/messages'
import {MB} from './constants'

process.title = 'dash-p2p'

// Without these the parent sees only `exit code=1` with no cause. Logged (for
// the parent's stderr tail) *and* forwarded as an `error` event, so the cause
// is recorded even when no one is watching the terminal.
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

// Pure IPC adapter — every concern lives in SyncService and below. Keep logic
// out of this file.

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
  cursorReset: (walletId, height) =>
    process.parentPort.postMessage({type: 'cursorReset', walletId, height}),
  gapExhausted: gap => process.parentPort.postMessage({type: 'gapExhausted', gap}),
  error: message => process.parentPort.postMessage({type: 'error', message}),
  broadcastResult: (requestId, ok, result, errorMessage) =>
    process.parentPort.postMessage({type: 'broadcastResult', requestId, ok, result, errorMessage}),
  txInstantLocked: (txid, islockHex) =>
    process.parentPort.postMessage({type: 'txInstantLocked', txid, islockHex}),
  chainLocked: (network, height) =>
    process.parentPort.postMessage({type: 'chainLocked', network, height}),
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
    case 'listen':
      sync.listen(data).catch(err => {
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

setInterval(() => {
  const m = process.memoryUsage()
  console.log(
    `[p2p-mem] rss=${(m.rss / MB).toFixed(0)}MB heapUsed=${(m.heapUsed / MB).toFixed(0)}MB ` +
    `heapTotal=${(m.heapTotal / MB).toFixed(0)}MB external=${(m.external / MB).toFixed(0)}MB ` +
    `arrayBuffers=${(m.arrayBuffers / MB).toFixed(0)}MB`,
  )
}, 60_000).unref()
