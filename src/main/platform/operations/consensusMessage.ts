import {deserializeConsensusError} from 'dash-platform-sdk/src/utils/deserializeConsensusError.js'

import {CONSENSUS_DATA} from '../constants'

export function consensusMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const encoded = CONSENSUS_DATA.exec(message)?.[1]
  if (encoded == null) return message

  try {
    const decoded = deserializeConsensusError(encoded)
    return decoded.length > 0 ? decoded : message
  } catch {
    return message
  }
}
