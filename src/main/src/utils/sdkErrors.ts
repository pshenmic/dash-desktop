const ALREADY_IN_CHAIN = 'state transition already in chain'

export function isAlreadyInChain(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.toLowerCase().includes(ALREADY_IN_CHAIN)
}