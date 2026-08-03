export function truncateMiddle(value: string, head: number, tail: number = head): string {
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}
