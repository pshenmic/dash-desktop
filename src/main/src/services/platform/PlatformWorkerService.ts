import {utilityProcess, UtilityProcess} from 'electron'
import path from 'path'
import {randomUUID} from 'crypto'
import {logChildOutput} from '../../logTransport'
import {currentLogLevel} from '../../utils/logger'
import {PendingRequest, PlatformRequestOptions} from '../../types/PlatformWorker'
import {CHILD_OUTPUT_TAIL_LIMIT} from '../../constants/app'
import {DAPI_URLS_WAIT_MS} from '../../constants/dapi'
import {Network} from '../../types/Network'
import {LogLevel} from '../../types/Log'
import {Preferences} from '../../preferences'
import {setCoreDapi, setCoreDapiUrls} from '../../utils/coreSDK'
import {EvonodeDAO} from '../../database/EvonodeDAO'
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
import {Logger} from '../../utils/logger'

const log = new Logger('platform')


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
  private transitionBroadcast: (() => void) | null = null
  private readonly preferences: Preferences
  private readonly evonodeDAO: EvonodeDAO
  // Networks the current worker has pinned evonodes for, and requests waiting on one.
  private readonly pinnedNetworks = new Set<Network>()
  private readonly pinWaiters = new Map<Network, Array<() => void>>()

  constructor(preferences: Preferences, evonodeDAO: EvonodeDAO) {
    this.preferences = preferences
    this.evonodeDAO = evonodeDAO
  }

  // Forks the worker so the prover starts warming before anything is
  // requested. Reading status must never be what triggers work (finding P-4).
  start = (): void => {
    setCoreDapi(this.preferences.network.dapi)
    this.ensureChild()
  }

  onTransitionBroadcast(listener: () => void): void {
    this.transitionBroadcast = listener
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
    const pinning = kind === 'warmup' || kind === 'activeDapiUrls' || kind === 'dapiUrlStatus' ? null : this.untilPinned(network)
    if (pinning != null) await pinning
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

  // Never starts a child: a level change is not a reason to boot the prover,
  // and a child forked later reads the level in ensureChild.
  setLogLevel(level: LogLevel): void {
    this.child?.postMessage({type: 'setLogLevel', level})
  }

  reloadDapi(): void {
    setCoreDapi(this.preferences.network.dapi)
    this.child?.postMessage({type: 'setDapi', dapi: this.preferences.network.dapi})
  }

  // Holds a request until the worker can build an SDK for the network: none can
  // before its first evonode list has been probed.
  private untilPinned(network: Network): Promise<void> | null {
    const {dapi} = this.preferences.network
    if (this.pinnedNetworks.has(network) || (dapi.mode === 'static' && dapi[network].length > 0)) return null
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no reachable evonode for ${network} after ${DAPI_URLS_WAIT_MS / 1000}s`)),
        DAPI_URLS_WAIT_MS,
      )
      this.pinWaiters.set(network, [...this.pinWaiters.get(network) ?? [], () => {
        clearTimeout(timer)
        resolve()
      }])
    })
  }

  // Saved before it is forwarded, so a worker forked later starts from it too.
  setEvonodeDapiUrls = async (network: Network, dapiUrls: string[]): Promise<void> => {
    await this.evonodeDAO.replaceDapiUrls(network, dapiUrls)
    log.info(`${network}: pinning gRPC from the p2p masternode list (${dapiUrls.length} evonode(s), saved to db)`)
    this.child?.postMessage({type: 'setEvonodeDapiUrls', network, dapiUrls})
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
      log.info(`utility process exited code=${code}`)
      if (tail) log.error(`last output before exit:\n${tail}`)
      this.child = null
      this.pinnedNetworks.clear()
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

    child.postMessage({type: 'setLogLevel', level: currentLogLevel()})
    child.postMessage({type: 'setDapi', dapi: this.preferences.network.dapi})
    this.evonodeDAO.getDapiUrls()
      .then(byNetwork => {
        if (this.child !== child) return
        for (const [network, dapiUrls] of byNetwork) {
          log.info(`${network}: pinning gRPC from db (${dapiUrls.length} saved evonode(s))`)
          // Unprobed, but real evonodes rather than the core SDK's own seeds until
          // the worker's probed set replaces them.
          setCoreDapiUrls(network, dapiUrls)
          child.postMessage({type: 'setEvonodeDapiUrls', network, dapiUrls})
        }
      })
      .catch(err => log.error('reading saved evonodes failed:', err))

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
        log.warn(`response for unknown request ${event.requestId}`)
        return
      }
      record.settle(event.ok ? {ok: true, result: event.result} : {ok: false, error: event.error})
    } else if (event.type === 'progress') {
      if (event.phase === 'broadcasting') this.transitionBroadcast?.()
      this.progressHandlers.get(event.requestId)?.onProgress?.(event.phase, event.fetched, event.total)
    } else if (event.type === 'notesSpent') {
      this.progressHandlers.get(event.requestId)?.onNotesSpent?.(event.indexes)
    } else if (event.type === 'pinnedDapiUrls') {
      setCoreDapiUrls(event.network, event.dapiUrls)
      this.pinnedNetworks.add(event.network)
      for (const wake of this.pinWaiters.get(event.network) ?? []) wake()
      this.pinWaiters.delete(event.network)
    } else if (event.type === 'error') {
      log.error('utility process error:', event.message)
    }
  }
}
