import {Logger, configureLogger} from '../src/utils/logger'
import {PlatformService} from './PlatformService'
import {SdkRegistry} from './SdkRegistry'
import {PlatformCommand, PlatformEvent} from './types/messages'

// The parent re-logs this process's stdout, so every line carries its level.
configureLogger({levelPrefix: true})

const log = new Logger('platform')

process.title = 'dash-platform'

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
  if (data.type === 'setLogLevel') {
    configureLogger({level: data.level})
    return
  }
  service.handle(data)
})

// Push the initial 'idle' state to the parent, then start the Halo2 key build
// in the background. Nothing awaits it — its outcome rides on the status.
process.parentPort.postMessage({type: 'status', status: service.getStatus()})
service.warmup().catch(() => {
  // Already reported as prover: 'error' on the status push.
})
