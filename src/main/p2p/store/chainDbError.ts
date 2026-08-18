// The LevelDB code has to survive into the message text, because that text is
// all isFatalChainDbError below gets to match on.
export function formatChainDbError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const code = (err as { code?: string }).code
  return code ? `${code}: ${message}` : message
}

// chain.db is unusable past this point (corruption, IO error, folder unlinked
// mid-sync) — workers cannot safely keep running and main must resetSync.
export function isFatalChainDbError(message: string): boolean {
  return /LEVEL_(CORRUPTION|IO_ERROR|DATABASE_NOT_OPEN|NOT_FOUND)|ENOENT|EBADF/i.test(message)
}
