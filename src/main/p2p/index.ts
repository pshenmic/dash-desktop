import {Logger, configureLogger} from '../src/utils/logger'
import {SyncService} from './sync/SyncService'
import {P2PCommand, P2PEvent} from './types/messages'

// The parent re-logs this process's stdout, so every line carries its level.
configureLogger({levelPrefix: true})

const log = new Logger('p2p')

process.title = 'dash-p2p'

// Without these the parent sees only `exit code=1` with no cause. Logged (for
// the parent's stderr tail) *and* forwarded as an `error` event, so the cause
// is recorded even when no one is watching the terminal.
function reportFatal(label: string, value: unknown): void {
  const detail = value instanceof Error ? (value.stack ?? value.message) : String(value)
  log.error(`${label}:`, value)
  try {
    process.parentPort.postMessage({type: 'error', message: `${label}: ${detail}`})
  } catch {
    // parentPort may already be torn down during shutdown — the log.error above still lands.
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
  chainRewound: (walletId, height) =>
    process.parentPort.postMessage({type: 'chainRewound', walletId, height}),
  incomingTx: (walletId, tx) =>
    process.parentPort.postMessage({type: 'incomingTx', walletId, tx}),
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
    case 'reseedUtxos':
      sync.reseedUtxos(data)
      return
    case 'setLogLevel':
      configureLogger({level: data.level})
      return
  }
})

// Push the initial 'idle' state to the parent.
process.parentPort.postMessage({type: 'status', status: sync.getStatus()})
