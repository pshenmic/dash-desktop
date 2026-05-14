import {EventEmitter} from 'events'

// Common worker contract. Each p2p concern (header sync, cfilter sync,
// future mempool/masternode/platform) is a Worker. The Orchestrator owns
// the lifecycle and consumes the events.
//
// Contract:
//   - start() boots the worker; safe to call after a previous stop().
//   - stop() releases resources; idempotent.
//   - Workers emit:
//       * 'status' — partial status (worker-defined shape) any time the
//         worker progresses. Orchestrator merges into wire WalletSyncStatus.
//       * 'error' — non-fatal error report. Orchestrator forwards.
//   - Workers may emit additional typed events (e.g. HeaderSyncWorker
//     emits 'chainExtended' so CFilterSyncWorker can react in real time).
//
// Workers do NOT touch the parent IPC, do NOT own a peer pool, and do
// NOT instantiate ChainDAO. They receive ChainStore + PeerPool via the
// constructor; that's their entire dependency surface.

export interface WorkerErrorEvent {
  message: string
  recoverable: boolean
}

export abstract class Worker extends EventEmitter {
  abstract readonly name: string
  abstract start(): Promise<void> | void
  abstract stop(): Promise<void> | void

  protected reportError(message: string, recoverable = true): void {
    this.emit('error', {message, recoverable} as WorkerErrorEvent)
  }
}