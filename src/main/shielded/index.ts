import {DashPlatformSDK} from 'dash-platform-sdk'
import {ShieldedEngine} from './ShieldedEngine'
import {ShieldedCommand, ShieldedEvent} from './types/messages'

// Utility-process entry for the shielded (Orchard) subsystem. The Halo2
// prover and note trial-decryption are CPU-bound, so they run here instead
// of blocking the main process' event loop — same split as the L1 p2p
// worker. This file only bridges parentPort messages to ShieldedEngine.

declare const process: NodeJS.Process & {
  parentPort: {
    on: (event: 'message', listener: (msg: { data: ShieldedCommand }) => void) => void
    postMessage: (msg: ShieldedEvent) => void
  }
}

function reportFatal(label: string, value: unknown): void {
  const detail = value instanceof Error ? (value.stack ?? value.message) : String(value)
  console.error(`[shielded] ${label}:`, value)
  try {
    process.parentPort.postMessage({type: 'error', message: `${label}: ${detail}`})
  } catch {
    // parentPort may already be torn down during shutdown — the console.error above still lands.
  }
}
process.on('uncaughtException', (err) => {
  reportFatal('uncaughtException', err)
})
process.on('unhandledRejection', (reason) => {
  reportFatal('unhandledRejection', reason)
})

const sdk = new DashPlatformSDK({ network: 'testnet' })
const engine = new ShieldedEngine(sdk, event => process.parentPort.postMessage(event))

process.parentPort.on('message', ({data}) => {
  switch (data.type) {
    case 'initProver':
      engine.initProver().catch(() => { /* reported via proverStatus */ })
      return
    case 'sync':
      void engine.sync(data)
      return
    case 'spend':
      void engine.spend(data)
      return
    case 'shield':
      void engine.shield(data)
      return
  }
})
