import {createClient} from 'dash-platform-sdk'
import status from 'dash-platform-sdk/src/node/status.js'
import {Network} from '../../src/types/Network'
import {EVONODE_STATUS_TIMEOUT_MS} from '../constants'
import {EvonodeStatus} from '../types/messages'

export function probeActiveEvonodes(dapiUrls: string[], network: Network): Promise<EvonodeStatus[]> {
  return Promise.all(dapiUrls.map(dapiUrl => probe(dapiUrl, network)))
}

async function probe(dapiUrl: string, network: Network): Promise<EvonodeStatus> {
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), EVONODE_STATUS_TIMEOUT_MS)
  const started = performance.now()
  try {
    const nodeStatus = await status({network, getClient: () => createClient(dapiUrl, abortController)})
    return {
      dapiUrl,
      proTxHash: nodeStatus.node?.proTxHash ?? null,
      pingMs: Math.round(performance.now() - started),
      driveVersion: nodeStatus.version?.software?.drive ?? null,
      blockHeight: nodeStatus.chain != null ? BigInt(nodeStatus.chain.latestBlockHeight) : null,
    }
  } catch {
    return {dapiUrl, proTxHash: null, pingMs: null, driveVersion: null, blockHeight: null}
  } finally {
    clearTimeout(timer)
  }
}
