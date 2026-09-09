import {DashPlatformSDK} from 'dash-platform-sdk'
import {KeyedLane, Lane} from './Lane'
import {laneFor, PROVER_LANE} from './constants'
import {SdkSource} from './types/sdk'
import {Network} from '../src/types/Network'
import {OperationContext} from './operations/types'
import {nodeStatus} from './operations/nodeStatus'
import {spendFeeCurve, transitionFee} from './operations/fee'
import {addressInfos} from './operations/address/infos'
import {addressTransfer} from './operations/address/transfer'
import {addressWithdrawal} from './operations/address/withdrawal'
import {identityCreateFromAddresses} from './operations/address/createIdentity'
import {identityTopUpFromAddresses} from './operations/address/topUpIdentity'
import {identityBalance} from './operations/identity/balance'
import {identityCreditTransfer} from './operations/identity/creditTransfer'
import {identityCreditsToAddresses} from './operations/identity/creditsToAddresses'
import {identityExists} from './operations/identity/exists'
import {identityInfos} from './operations/identity/infos'
import {identityScan} from './operations/identity/scan'
import {identityNonce} from './operations/identity/nonce'
import {identityWithdrawal} from './operations/identity/withdrawal'
import {checkNullifiers} from './operations/shielded/reads/checkNullifiers'
import {encryptedNotes} from './operations/shielded/reads/encryptedNotes'
import {notesCount} from './operations/shielded/reads/notesCount'
import {poolInfo} from './operations/shielded/reads/poolInfo'
import {shield} from './operations/shielded/shield'
import {shieldFromAssetLock} from './operations/assetLock/shield'
import {addressFundingFromAssetLock} from './operations/assetLock/addressFunding'
import {identityCreateFromAssetLock} from './operations/assetLock/identityCreate'
import {identityTopUpFromAssetLock} from './operations/assetLock/identityTopUp'
import {spend} from './operations/shielded/spend/spend'
import {sync} from './operations/shielded/sync'
import {
  emptyPlatformStatus,
  PlatformCommand,
  PlatformError,
  PlatformErrorCode,
  PlatformEvent,
  PlatformRequestMessage,
  PlatformWorkerStatus,
  ProverState,
} from './types/messages'
import {ERROR_CODES} from './constants'
import {InFlight} from './types/service'

// Orchestrator for the platform utility process: owns the SDKs and the lanes,
// dispatches commands, and aggregates status. Mirrors p2p/sync/SyncService — it
// never touches parentPort (that is index.ts' job), never opens storage, and
// holds no wallet state. Operations receive an OperationContext and know
// nothing about the transport.
export class PlatformService {
  private readonly registry: SdkSource
  private readonly emit: (event: PlatformEvent) => void
  private readonly proverLane = new Lane()
  private readonly signerLanes = new KeyedLane()
  private readonly inFlight = new Map<string, InFlight>()
  private reads = 0
  private status: PlatformWorkerStatus = emptyPlatformStatus()

  constructor(registry: SdkSource, emit: (event: PlatformEvent) => void) {
    this.registry = registry
    this.emit = emit
  }

  getStatus(): PlatformWorkerStatus {
    return this.status
  }

  handle(command: PlatformCommand): void {
    if (command.type === 'cancel') {
      this.cancel(command.requestId)
      return
    }
    this.dispatch(command)
  }

  // Idempotent. Called at boot with no one waiting — its outcome is the
  // `prover` field of the pushed status — and by the warmup command, which
  // resolves once the key is built.
  async warmup(): Promise<ProverState> {
    if (this.status.prover === 'ready') return 'ready'
    this.setProverStatus('preparing', null)
    try {
      await this.registry.warmup()
      this.setProverStatus('ready', null)
      return 'ready'
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setProverStatus('error', message)
      throw err
    }
  }

  private dispatch(request: PlatformRequestMessage): void {
    if (this.inFlight.has(request.requestId)) {
      this.emit({
        type: 'response',
        requestId: request.requestId,
        ok: false,
        error: {message: `duplicate requestId ${request.requestId}`, stHash: null, code: 'internal'},
      })
      return
    }

    const record: InFlight = {controller: new AbortController(), settled: false}
    this.inFlight.set(request.requestId, record)

    const lane = laneFor(request)
    // The prover lane is the set of operations that need the WASM builder, and
    // boot warm-up runs outside the lanes, so the gate goes here rather than in
    // execute — a failed key build must not read as a network failure.
    const task = async (): Promise<unknown> => {
      if (lane === PROVER_LANE) await this.warmup()
      return this.execute(request, record.controller.signal)
    }

    let work: Promise<unknown>
    if (lane == null) {
      this.reads++
      work = task().finally(() => {
        this.reads--
        this.publishStatus()
      })
    } else if (lane === PROVER_LANE) {
      work = this.proverLane.run(task)
    } else {
      work = this.signerLanes.run(lane, task)
    }

    this.publishStatus()
    work.then(
      result => this.finish(request.requestId, record, {ok: true, result}),
      err => this.finish(request.requestId, record, {ok: false, error: toPlatformError(err)}),
    )
  }

  private finish(
    requestId: string,
    record: InFlight,
    outcome: {ok: true; result: unknown} | {ok: false; error: PlatformError},
  ): void {
    if (record.settled) return
    record.settled = true
    this.inFlight.delete(requestId)
    if (outcome.ok) {
      this.emit({type: 'response', requestId, ok: true, result: outcome.result})
    } else {
      this.emit({type: 'response', requestId, ok: false, error: outcome.error})
    }
    this.publishStatus()
  }

  // Answers the caller now; the lane stays held until the task actually
  // settles, because a running Halo2 proof or gRPC call cannot be stopped.
  private cancel(requestId: string): void {
    const record = this.inFlight.get(requestId)
    if (record == null) return
    record.controller.abort()
    this.finish(requestId, record, {
      ok: false,
      error: {message: `${requestId} cancelled`, stHash: null, code: 'cancelled'},
    })
  }

  private async execute(request: PlatformRequestMessage, signal: AbortSignal): Promise<unknown> {
    const sdk = this.registry.get(request.network)
    try {
      const result = await this.run(request, sdk, signal)
      this.setNetworkStatus(request.network, 'ready', null)
      return result
    } catch (err) {
      if (request.kind !== 'warmup') {
        this.setNetworkStatus(request.network, 'error', err instanceof Error ? err.message : String(err))
      }
      throw err
    }
  }

  private async run(
    request: PlatformRequestMessage,
    sdk: DashPlatformSDK,
    signal: AbortSignal,
  ): Promise<unknown> {
    const {requestId, network} = request
    const ctx: OperationContext = {
      sdk,
      network,
      signal,
      progress: (phase, fetched, total) => this.emit({type: 'progress', requestId, phase, fetched, total}),
      notesSpent: indexes => this.emit({type: 'notesSpent', requestId, indexes}),
    }

    switch (request.kind) {
      case 'warmup': return {prover: await this.warmup()}
      case 'sync': return sync(request.payload, ctx)
      case 'spend': return spend(request.payload, ctx)
      case 'shield': return shield(request.payload, ctx)
      case 'shieldFromAssetLock': return shieldFromAssetLock(request.payload, ctx)
      case 'addressFundingFromAssetLock': return addressFundingFromAssetLock(request.payload, ctx)
      case 'identityCreateFromAssetLock': return identityCreateFromAssetLock(request.payload, ctx)
      case 'identityTopUpFromAssetLock': return identityTopUpFromAssetLock(request.payload, ctx)
      case 'transitionFee': return transitionFee(request.payload, ctx)
      case 'spendFeeCurve': return spendFeeCurve(request.payload)
      case 'addressInfos': return addressInfos(request.payload, ctx)
      case 'addressTransfer': return addressTransfer(request.payload, ctx)
      case 'addressWithdrawal': return addressWithdrawal(request.payload, ctx)
      case 'identityCreateFromAddresses': return identityCreateFromAddresses(request.payload, ctx)
      case 'identityTopUpFromAddresses': return identityTopUpFromAddresses(request.payload, ctx)
      case 'identityCreditsToAddresses': return identityCreditsToAddresses(request.payload, ctx)
      case 'identityCreditTransfer': return identityCreditTransfer(request.payload, ctx)
      case 'identityWithdrawal': return identityWithdrawal(request.payload, ctx)
      case 'identityExists': return identityExists(request.payload, ctx)
      case 'identityBalance': return identityBalance(request.payload, ctx)
      case 'identityNonce': return identityNonce(request.payload, ctx)
      case 'identityInfos': return identityInfos(request.payload, ctx)
      case 'identityScan': return identityScan(request.payload, ctx)
      case 'nodeStatus': return nodeStatus(ctx)
      case 'poolInfo': return poolInfo(ctx)
      case 'notesCount': return notesCount(ctx)
      case 'encryptedNotes': return encryptedNotes(request.payload, ctx)
      case 'checkNullifiers': return checkNullifiers(request.payload, ctx)
    }
  }

  private setProverStatus(prover: ProverState, proverError: string | null): void {
    this.status = {...this.status, prover, proverError}
    this.publishStatus()
  }

  private setNetworkStatus(network: Network, pool: 'ready' | 'error', error: string | null): void {
    const current = this.status.networks[network]
    if (current.pool === pool && current.error === error) return
    this.status = {...this.status, networks: {...this.status.networks, [network]: {pool, error}}}
    this.publishStatus()
  }

  private publishStatus(): void {
    const next: PlatformWorkerStatus = {
      ...this.status,
      inFlight: {prover: this.proverLane.size, signer: this.signerLanes.size, read: this.reads},
      updatedAt: Date.now(),
    }
    const changed = !sameStatus(this.status, next)
    this.status = next
    if (changed) this.emit({type: 'status', status: next})
  }
}

function sameStatus(a: PlatformWorkerStatus, b: PlatformWorkerStatus): boolean {
  return (
    a.prover === b.prover &&
    a.proverError === b.proverError &&
    a.inFlight.prover === b.inFlight.prover &&
    a.inFlight.signer === b.inFlight.signer &&
    a.inFlight.read === b.inFlight.read &&
    a.networks.mainnet.pool === b.networks.mainnet.pool &&
    a.networks.mainnet.error === b.networks.mainnet.error &&
    a.networks.testnet.pool === b.networks.testnet.pool &&
    a.networks.testnet.error === b.networks.testnet.error
  )
}

// Always a plain object: structured clone drops the own properties of an Error
// subclass, so an OperationError forwarded as-is would arrive without its code.
function toPlatformError(err: unknown): PlatformError {
  const message = err instanceof Error ? err.message : String(err)
  if (err == null || typeof err !== 'object') return {message, stHash: null, code: 'internal'}
  const {code, stHash} = err as {code?: unknown; stHash?: unknown}
  return {
    message,
    stHash: typeof stHash === 'string' ? stHash : null,
    code: typeof code === 'string' && ERROR_CODES.includes(code) ? (code as PlatformErrorCode) : 'internal',
  }
}
