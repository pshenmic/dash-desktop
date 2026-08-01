import {PlatformService} from './PlatformService'
import {SdkRegistry} from './SdkRegistry'
import {PlatformCommand, PlatformEvent} from './types/messages'
import {MB} from './constants'

process.title = 'dash-platform'

// Diagnostic: surface anything that would otherwise silently kill the utility
// process. Without these the parent only sees `exit code=1` with no clue about
// the cause. We log (captured by the parent's stderr tail) AND forward to the
// parent as an `error` event so the cause is recorded centrally even when no
// one is watching the terminal.
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

// Utility-process entry for every Dash Platform state transition. Pure IPC
// adapter — the SDKs, lanes and engines live in PlatformService and below.
// This file exists only to bridge parentPort messages to method calls.

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

// Periodic resident-memory log so the platform footprint can be tracked
// without an external profiler. With two SDK instances in one process this is
// the number that answers whether that costs anything.
setInterval(() => {
  const m = process.memoryUsage()
  console.log(
    `[platform-mem] rss=${(m.rss / MB).toFixed(0)}MB heapUsed=${(m.heapUsed / MB).toFixed(0)}MB ` +
    `heapTotal=${(m.heapTotal / MB).toFixed(0)}MB external=${(m.external / MB).toFixed(0)}MB ` +
    `arrayBuffers=${(m.arrayBuffers / MB).toFixed(0)}MB`,
  )
}, 60_000).unref()