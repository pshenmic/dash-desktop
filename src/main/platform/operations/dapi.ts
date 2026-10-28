import {createClient} from 'dash-platform-sdk'
import status from 'dash-platform-sdk/src/node/status.js'
import {Network} from '../../src/types/Network'
import {DAPI_MAX_BLOCK_AGE_MS, DAPI_POOL_READY, DAPI_PROBE_BATCH, DAPI_STATUS_TIMEOUT_MS} from '../constants'
import {DapiUrlStatus} from '../types/messages'
import {Logger} from '../../src/utils/logger'

const log = new Logger('platform')

export async function reachableDapiUrls(candidates: string[], network: Network): Promise<string[]> {
  const shuffled = [...candidates]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = shuffled[i]!
    shuffled[i] = shuffled[j]!
    shuffled[j] = swap
  }
  for (let start = 0; start < shuffled.length; start += DAPI_PROBE_BATCH) {
    const batch = shuffled.slice(start, start + DAPI_PROBE_BATCH)
    const reachable = await new Promise<string[]>(resolve => {
      const found: string[] = []
      let pending = batch.length
      for (const dapiUrl of batch) {
        void probeDapiUrl(dapiUrl, network).then(({error, pingMs}) => {
          log.debug(`probe ${dapiUrl}: ${error ?? `${pingMs}ms`}`)
          pending--
          if (error == null) found.push(dapiUrl)
          if (found.length >= DAPI_POOL_READY || pending === 0) resolve(found.slice(0, DAPI_POOL_READY))
        })
      }
    })
    if (reachable.length > 0) return reachable
  }
  return []
}

export function probeActiveDapiUrls(dapiUrls: string[], network: Network): Promise<DapiUrlStatus[]> {
  return Promise.all(dapiUrls.map(dapiUrl => probeDapiUrl(dapiUrl, network)))
}

// Every failure answers rather than rejecting: a caller waiting on the IPC
// reply would otherwise sit out its own timeout for an error already known.
export async function probeDapiUrl(dapiUrl: string, network: Network): Promise<DapiUrlStatus> {
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), DAPI_STATUS_TIMEOUT_MS)
  const started = performance.now()
  try {
    const nodeStatus = await status({network, getClient: () => createClient(dapiUrl, abortController)})
    // The SDK health-checks only nodes it discovers, never a url list it is handed.
    // time.local is in seconds, time.block in milliseconds.
    const blockAgeMs = Number(nodeStatus.time?.local) * 1000 - Number(nodeStatus.time?.block)
    const issue = nodeStatus.chain == null || nodeStatus.chain.catchingUp
      ? 'still syncing'
      : blockAgeMs <= DAPI_MAX_BLOCK_AGE_MS ? null : 'chain stalled: no recent block'
    return {
      dapiUrl,
      proTxHash: nodeStatus.node?.proTxHash ?? null,
      pingMs: Math.round(performance.now() - started),
      driveVersion: nodeStatus.version?.software?.drive ?? null,
      blockHeight: nodeStatus.chain != null ? BigInt(nodeStatus.chain.latestBlockHeight) : null,
      error: issue,
    }
  } catch (err) {
    const error = abortController.signal.aborted
      ? `no getStatus answer within ${DAPI_STATUS_TIMEOUT_MS}ms`
      : err instanceof Error ? err.message : String(err)
    return {dapiUrl, proTxHash: null, pingMs: null, driveVersion: null, blockHeight: null, error}
  } finally {
    clearTimeout(timer)
  }
}
