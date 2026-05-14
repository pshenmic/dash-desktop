import {SyncService} from './SyncService'
import {P2PCommand, P2PEvent} from './types/messages'

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
  }
})

// Push the initial 'idle' state to the parent.
process.parentPort.postMessage({type: 'status', status: sync.getStatus()})