import {EventEmitter} from 'events'
import {WorkerErrorEvent} from '../../types/worker'

// Workers never touch the parent IPC and never own a peer pool or ChainDAO —
// ChainStore + PeerPool arrive via the constructor and are the whole dependency
// surface. start() and stop() must both be safe to call twice.

export abstract class Worker extends EventEmitter {
  abstract readonly name: string
  abstract start(): Promise<void> | void
  abstract stop(): Promise<void> | void

  protected reportError(message: string, recoverable = true): void {
    this.emit('error', {message, recoverable} as WorkerErrorEvent)
  }
}