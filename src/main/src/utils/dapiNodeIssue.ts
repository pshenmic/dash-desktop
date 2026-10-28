import type {NodeStatus} from 'dash-platform-sdk/types.js'
import {DAPI_MAX_BLOCK_AGE_MS} from '../constants/dapi'

// The SDK health-checks only nodes it discovers, never a url list it is handed.
export function dapiNodeIssue(status: NodeStatus): string | null {
  if (status.chain == null || status.chain.catchingUp) return 'still syncing'
  // time.local is in seconds, time.block in milliseconds.
  const blockAgeMs = Number(status.time?.local) * 1000 - Number(status.time?.block)
  if (!(blockAgeMs <= DAPI_MAX_BLOCK_AGE_MS)) return 'chain stalled: no recent block'
  return null
}
