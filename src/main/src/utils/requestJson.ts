import {net} from 'electron'
import {JsonRequest, JsonRequestError} from '../types/JsonRequest'

// Reads a REST endpoint. Retrying is only safe because nothing here writes:
// broadcast goes out over the p2p pool, and a payload is a batch query.
export async function requestJson<T>(request: JsonRequest, path: string, payload?: unknown): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= request.retryDelaysMs.length; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, request.retryDelaysMs[attempt - 1]))

    let response: Response
    try {
      response = await net.fetch(`${request.baseUrl}${path}`, {
        signal: AbortSignal.timeout(request.timeoutMs),
        ...(payload != null
          ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)}
          : {}),
      })
    } catch (err) {
      lastError = err
      continue
    }

    if (response.ok) return await response.json() as T

    const body = (await response.text().catch(() => '')).slice(0, 500)
    lastError = Object.assign(
      new Error(`${response.status}${body ? ` — ${body}` : ''}`),
      {status: response.status},
    )
    // 4xx is our request being wrong; repeating it just wastes the deadline.
    if (response.status < 500 && response.status !== 429) break
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw Object.assign(
    new Error(`${request.source} request failed (${path}): ${detail}`),
    {status: (lastError as {status?: number}).status ?? null},
  ) as JsonRequestError
}
