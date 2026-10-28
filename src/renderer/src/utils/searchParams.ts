export function enumParam<T extends string>(values: Record<string, T>, raw: string | null | undefined, fallback: T): T {
  return Object.values(values).find(value => value === raw) ?? fallback
}
