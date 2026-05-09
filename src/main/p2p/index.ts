import {Orchestrator} from './Orchestrator'
import {P2PCommand, P2PEvent} from './messages'

// Utility-process entry. Pure IPC adapter — every concern (chain.db,
// peer pool, header/cfilter workers, status aggregation) lives in the
// Orchestrator and below. This file exists only to bridge parentPort
// messages to/from Orchestrator method calls.

declare const process: NodeJS.Process & {
  parentPort: {
    on: (event: 'message', listener: (msg: { data: P2PCommand }) => void) => void
    postMessage: (msg: P2PEvent) => void
  }
}

const orchestrator = new Orchestrator({
  status: status => process.parentPort.postMessage({type: 'status', status}),
  utxos: utxos => process.parentPort.postMessage({type: 'utxos', utxos}),
  error: message => process.parentPort.postMessage({type: 'error', message}),
})

process.parentPort.on('message', ({data}) => {
  switch (data.type) {
    case 'start':
      console.log(data)
      orchestrator.start(data).catch(err => {
        const message = err instanceof Error ? err.message : String(err)
        process.parentPort.postMessage({type: 'error', message})
      })
      return
    case 'stop':
      console.log(data)
      orchestrator.stop().catch(err => {
        const message = err instanceof Error ? err.message : String(err)
        process.parentPort.postMessage({type: 'error', message})
      })
      return
    case 'addWatchAddresses':
      orchestrator.addWatchAddresses(data)
      return
  }
})

// Push the initial 'idle' state to the parent.
process.parentPort.postMessage({type: 'status', status: orchestrator.getStatus()})