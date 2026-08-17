import {utilityProcess, UtilityProcess} from 'electron'
import path from 'path'
import {randomUUID} from 'crypto'
import {logChildOutput} from '../../logger'
import {PendingRequest, PlatformRequestOptions} from '../../types/PlatformWorker'
import {CHILD_OUTPUT_TAIL_LIMIT} from '../../constants'
import {Network} from '../../types/Network'
import {
  emptyPlatformStatus,
  PlatformCommand,
  PlatformError,
  PlatformEvent,
  PlatformKind,
  PlatformOperationResult,
  PlatformPayload,
  PlatformRequestMessage,
  PlatformWorkerStatus,
} from '../../../platform/types/messages'


export class PlatformWorkerError extends Error {
  readonly code: PlatformError['code']
  readonly stHash: string | null

  constructor(error: PlatformError) {
    super(error.message)
    this.name = 'PlatformWorkerError'
    this.code = error.code
    this.stHash = error.stHash
  }
}

// Main-process facade for the platform utility process. Forks it, correlates
// requests by requestId, and fails every pending request when the child dies —
// which is what keeps a crash from hanging an IPC handler forever. Mirrors
// WalletSyncService's relationship to the p2p worker.
//
// It holds no wallet state and performs no DAO writes — callers own both.
export class PlatformWorkerService {
  private child: UtilityProcess | null = null
  private childOutputTail = ''
  private readonly pending = new Map<string, PendingRequest>()
  private readonly progressHandlers = new Map<string, PlatformRequestOptions>()
  private status: PlatformWorkerStatus = emptyPlatformStatus()

  // Forks the worker so the prover starts warming before anything is
  // requested. Reading status must never be what triggers work (finding P-4).
  start = (): void => {
    this.ensureChild()
  }

  getStatus(): PlatformWorkerStatus {
    return this.status
  }

  request = async <K extends PlatformKind>(
    kind: K,
    network: Network,
    payload: PlatformPayload<K>,
    options: PlatformRequestOptions = {},
  ): Promise<PlatformOperationResult<K>> => {
    const requestId = randomUUID()

    if (options.onProgress != null || options.onNotesSpent != null) {
      this.progressHandlers.set(requestId, options)
    }

    const settled = new Promise<PlatformOperationResult<K>>((resolve, reject) => {
      this.pending.set(requestId, {
        kind,
        settle: outcome => {
          this.pending.delete(requestId)
          this.progressHandlers.delete(requestId)
          if (outcome.ok) {
            resolve(outcome.result as PlatformOperationResult<K>)
          } else {
            reject(new PlatformWorkerError(outcome.error))
          }
        },
      })
    })

    // The envelope is built from a generic K, which TypeScript cannot match
    // against the per-kind union without re-narrowing every kind by hand.
    const request = {type: 'request', requestId, kind, network, payload} as PlatformRequestMessage
    this.send(request)
    return settled
  }

  cancel = (requestId: string): void => {
    if (!this.pending.has(requestId)) return
    this.send({type: 'cancel', requestId})
  }

  shutdown = async (): Promise<void> => {
    if (this.child == null) return
    const child = this.child
    const exited = new Promise<void>(resolve => {
      child.once('exit', () => resolve())
    })
    child.kill()
    await exited
    this.child = null
  }

  private send(command: PlatformCommand): void {
    this.ensureChild().postMessage(command)
  }

  private ensureChild(): UtilityProcess {
    if (this.child != null) return this.child

    const scriptPath = path.join(__dirname, 'platform.js')
    this.childOutputTail = ''
    const child = utilityProcess.fork(scriptPath, [], {
      serviceName: 'platform',
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this.childOutputTail = (this.childOutputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
      logChildOutput('platform', text, false)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this.childOutputTail = (this.childOutputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
      logChildOutput('platform', text, true)
    })

    child.on('message', (event: PlatformEvent) => this.handleEvent(event))

    child.on('exit', code => {
      const tail = this.childOutputTail.trim()
      console.log(`[platform] utility process exited code=${code}`)
      if (tail) console.error(`[platform] last output before exit:\n${tail}`)
      this.child = null
      // Every pending request must be settled here or its caller hangs forever.
      const detail = tail ? `\n--- platform output (tail) ---\n${tail}` : ''
      for (const [requestId, record] of [...this.pending]) {
        record.settle({
          ok: false,
          error: {
            message: `platform utility process exited (code=${code}) before ${record.kind} ${requestId} completed${detail}`,
            stHash: null,
            code: 'internal',
          },
        })
      }
      this.pending.clear()
      this.progressHandlers.clear()
      // Reset so a restart re-runs warm-up rather than reporting a prover that
      // died with the process.
      this.status = emptyPlatformStatus()
    })

    this.child = child
    return child
  }

  private handleEvent(event: PlatformEvent): void {
    if (event.type === 'status') {
      this.status = event.status
    } else if (event.type === 'response') {
      const record = this.pending.get(event.requestId)
      // A response for a request main already settled — a cancel, or a restart.
      if (record == null) {
        console.warn(`[platform] response for unknown request ${event.requestId}`)
        return
      }
      record.settle(event.ok ? {ok: true, result: event.result} : {ok: false, error: event.error})
    } else if (event.type === 'progress') {
      this.progressHandlers.get(event.requestId)?.onProgress?.(event.phase, event.fetched, event.total)
    } else if (event.type === 'notesSpent') {
      this.progressHandlers.get(event.requestId)?.onNotesSpent?.(event.indexes)
    } else if (event.type === 'error') {
      console.error('[platform] utility process error:', event.message)
    }
  }
}
