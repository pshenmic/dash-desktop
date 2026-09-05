import {DashPlatformSDK} from 'dash-platform-sdk'
import {ShieldedNullifierStatus} from 'dash-platform-sdk/types.js'
import {PROVED_QUERY_LIMIT} from '../../../constants'

// Drive refuses an oversized query outright rather than truncating it, so a
// wallet past one page can only be asked about a page at a time.
export async function nullifierStatuses(
  sdk: DashPlatformSDK,
  nullifiers: Uint8Array[],
): Promise<ShieldedNullifierStatus[]> {
  const statuses: ShieldedNullifierStatus[] = []
  for (let start = 0; start < nullifiers.length; start += PROVED_QUERY_LIMIT) {
    const page = nullifiers.slice(start, start + PROVED_QUERY_LIMIT)
    statuses.push(...await sdk.shielded.getShieldedNullifiers(page))
  }
  return statuses
}
