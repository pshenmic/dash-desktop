import {deserializeConsensusError} from 'dash-platform-sdk/src/utils/deserializeConsensusError.js'

// waitForStateTransitionResult reports a rejection as
// `... code N, message: M, data: <base64>` — and `data` is the serialized
// consensus error, the same bytes the broadcast path runs through
// deserializeConsensusError. Decoding it here is the difference between the
// user seeing the reason and seeing a wall of base64.
const CONSENSUS_DATA = /data:\s*([A-Za-z0-9+/=]+)\s*$/

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