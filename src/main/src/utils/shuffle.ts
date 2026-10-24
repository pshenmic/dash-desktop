// Fisher–Yates; `sort(() => Math.random() - 0.5)` favours keeping the input order.
export function shuffled<T>(items: Iterable<T>): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = out[i]!
    out[i] = out[j]!
    out[j] = swap
  }
  return out
}
