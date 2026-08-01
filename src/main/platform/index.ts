import {PlatformService} from './PlatformService'
import {SdkRegistry} from './SdkRegistry'
import {PlatformCommand, PlatformEvent} from './types/messages'
import {MB} from './constants'

process.title = 'dash-platform'

// Without these the parent sees only `exit code=1` with no cause. Logged (for
// the parent's stderr tail) *and* forwarded as an `error` event, so the cause
// is recorded even when no one is watching the terminal.
function reportFatal(label: string, value: unknown): void {
  const detail = value instanceof Error ? (value.stack ?? value.message) : String(value)
  console.error(`[platform] ${label}:`, value)
  try {
    process.parentPort.postMessage({type: 'error', message: `${label}: ${detail}`})
  } catch {
    // parentPort may already be torn down during shutdown — the console.error above still lands.
  }
}
process.on('uncaughtException', err => {
  reportFatal('uncaughtException', err)
})
process.on('unhandledRejection', reason => {
  reportFatal('unhandledRejection', reason)
})

// Pure IPC adapter — the SDKs, lanes and engines live in PlatformService and
// below. Keep logic out of this file.

declare const process: NodeJS.Process & {
  parentPort: {
    on: (event: 'message', listener: (msg: {data: PlatformCommand}) => void) => void
    postMessage: (msg: PlatformEvent) => void
  }
}

const registry = new SdkRegistry()
const service = new PlatformService(registry, event => process.parentPort.postMessage(event))

process.parentPort.on('message', ({data}) => {
  service.handle(data)
})

// Push the initial 'idle' state to the parent, then start the Halo2 key build
// in the background. Nothing awaits it — its outcome rides on the status.
process.parentPort.postMessage({type: 'status', status: service.getStatus()})
service.warmup().catch(() => {
  // Already reported as prover: 'error' on the status push.
})

// Tracks the platform footprint without an external profiler — with two SDK
// instances in one process, this is what says whether that costs anything.
setInterval(() => {
  const m = process.memoryUsage()
  console.log(
    `[platform-mem] rss=${(m.rss / MB).toFixed(0)}MB heapUsed=${(m.heapUsed / MB).toFixed(0)}MB ` +
    `heapTotal=${(m.heapTotal / MB).toFixed(0)}MB external=${(m.external / MB).toFixed(0)}MB ` +
    `arrayBuffers=${(m.arrayBuffers / MB).toFixed(0)}MB`,
  )
}, 60_000).unref()