import {createClient} from 'dash-platform-sdk'
import status from 'dash-platform-sdk/src/node/status.js'
import {Network} from '../../src/types/Network'
import {DAPI_STATUS_TIMEOUT_MS} from '../constants'
import {DapiStatus} from '../types/messages'

export function probeActiveDapi(dapiUrls: string[], network: Network): Promise<DapiStatus[]> {
  return Promise.all(dapiUrls.map(dapiUrl => probeDapi(dapiUrl, network)))
}

// Every failure answers rather than rejecting: a caller waiting on the IPC
// reply would otherwise sit out its own timeout for an error already known.
export async function probeDapi(dapiUrl: string, network: Network): Promise<DapiStatus> {
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), DAPI_STATUS_TIMEOUT_MS)
  const started = performance.now()
  try {
    const nodeStatus = await status({network, getClient: () => createClient(dapiUrl, abortController)})
    return {
      dapiUrl,
      proTxHash: nodeStatus.node?.proTxHash ?? null,
      pingMs: Math.round(performance.now() - started),
      driveVersion: nodeStatus.version?.software?.drive ?? null,
      blockHeight: nodeStatus.chain != null ? BigInt(nodeStatus.chain.latestBlockHeight) : null,
      error: null,
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
