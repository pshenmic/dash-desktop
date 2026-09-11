export function formatCreationDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function timePart(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTimestamp(date: Date | null): string {
  if (date === null || !Number.isFinite(date.getTime())) return 'Unknown'
  return `${formatCreationDate(date)}, ${timePart(date)}`
}
