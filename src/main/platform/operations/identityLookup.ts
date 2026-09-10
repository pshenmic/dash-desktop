import {IDENTITY_NOT_FOUND} from '../constants'
import {Logger} from '../../src/utils/logger'

const log = new Logger('platform')

// Every identity read rejects when the identity is absent, so callers swallow
// the rejection to mean "not registered". An unreachable node rejects the same
// way and would read as the same answer — a scan reporting no identities, or a
// free index that is already taken — so anything but a miss is logged.
export async function lookupIdentity<T>(query: Promise<T>, label: string): Promise<T | null> {
  try {
    return await query
  } catch (err) {
    if (!IDENTITY_NOT_FOUND.test(err instanceof Error ? err.message : String(err))) {
      log.warn(`${label}: identity lookup failed:`, err)
    }
    return null
  }
}
