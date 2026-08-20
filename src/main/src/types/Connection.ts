export type RpcStatusFetcher = (
  url: string,
  init: {signal: AbortSignal},
) => Promise<{ok: boolean}>
