// One REST source: where it lives, how patient to be with it, and the name a
// failure is reported under, which the path alone does not carry.
export interface JsonRequest {
  baseUrl: string
  source: string
  timeoutMs: number
  retryDelaysMs: readonly number[]
}

// Carries the HTTP status so a caller can tell "not seen" from "no answer"
// without matching on message text. Null when no response arrived at all.
export interface JsonRequestError extends Error {
  status: number | null
}
