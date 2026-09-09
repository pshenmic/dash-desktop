// helper which allows to prepare data for log on preferences changes

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const render = (value: unknown): string => {
  if (value === null || value === undefined) return 'none'
  if (Array.isArray(value)) return value.length === 0 ? '[]' : `[${value.join(', ')}]`
  if (isRecord(value)) return JSON.stringify(value)
  return String(value)
}

// Compared as the JSON that reaches the file: the live halves are class
// instances whose methods are not part of what changed.
const asJson = (value: unknown): unknown =>
  value === undefined ? null : JSON.parse(JSON.stringify(value))

export function describePreferenceChanges(previous: unknown, next: unknown): string[] {
  const changes: string[] = []

  const walk = (path: string, before: unknown, after: unknown): void => {
    if (isRecord(before) && isRecord(after)) {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        walk(path === '' ? key : `${path}.${key}`, before[key], after[key])
      }
      return
    }
    if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return
    changes.push(`${path}: ${render(before)} -> ${render(after)}`)
  }

  walk('', asJson(previous), asJson(next))
  return changes
}
