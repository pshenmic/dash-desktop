export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error(`chunk: size must be at least 1, got ${size}`)

  return Array.from(
    {length: Math.ceil(items.length / size)},
    (_, i) => items.slice(i * size, i * size + size),
  )
}
