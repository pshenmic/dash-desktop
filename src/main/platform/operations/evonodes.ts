import {createClient} from 'dash-platform-sdk'
import status from 'dash-platform-sdk/src/node/status.js'
import {Network} from '../../src/types/Network'
import {quorumEvonodes} from '../../src/utils/quorumEvonodes'
import {DAPI_PORT, EVONODE_STATUS_TIMEOUT_MS} from '../constants'
import {EvonodeStatus} from '../types/messages'
import {OperationContext} from './types'

export async function probeQuorumEvonodes(ctx: OperationContext): Promise<EvonodeStatus[]> {
  const {validatorSets} = await ctx.sdk.node.getCurrentQuorumsInfo()
  const evonodes = quorumEvonodes(validatorSets, DAPI_PORT[ctx.network])
  return Promise.all(evonodes.map(evonode => probe(evonode.dapiUrl, evonode.proTxHash, ctx.network)))
}

export function probeActiveEvonodes(dapiUrls: string[], network: Network): Promise<EvonodeStatus[]> {
  return Promise.all(dapiUrls.map(dapiUrl => probe(dapiUrl, null, network)))
}

// A seed or user-entered url has no quorum entry, so its proTxHash comes from
// the node's own status.
async function probe(dapiUrl: string, proTxHash: string | null, network: Network): Promise<EvonodeStatus> {
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), EVONODE_STATUS_TIMEOUT_MS)
  const started = performance.now()
  try {
    const nodeStatus = await status({network, getClient: () => createClient(dapiUrl, abortController)})
    return {
      dapiUrl,
      proTxHash: proTxHash ?? nodeStatus.node?.proTxHash ?? null,
      pingMs: Math.round(performance.now() - started),
      driveVersion: nodeStatus.version?.software?.drive ?? null,
      blockHeight: nodeStatus.chain != null ? BigInt(nodeStatus.chain.latestBlockHeight) : null,
    }
  } catch {
    return {dapiUrl, proTxHash, pingMs: null, driveVersion: null, blockHeight: null}
  } finally {
    clearTimeout(timer)
  }
}
