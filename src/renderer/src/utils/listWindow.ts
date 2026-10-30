import type { DayGroup, DayGroupWindow, GroupWindow, ListGroup, ListWindow } from '@renderer/types/ListWindow'
import { formatCreationDate } from './date'

export function windowList<T>(items: T[], visibleCount: number): ListWindow<T> {
  return {
    items: items.slice(0, visibleCount),
    hasMore: visibleCount < items.length,
    remaining: Math.max(0, items.length - visibleCount),
  }
}

export function windowGroups<T>(groups: ListGroup<T>[], visibleCount: number): GroupWindow<T> {
  const visible: ListGroup<T>[] = []
  let shown = 0
  let total = 0
  for (const group of groups) {
    total += group.items.length
    const items = group.items.slice(0, Math.max(0, visibleCount - shown))
    shown += items.length
    if (items.length > 0) visible.push({ ...group, items })
  }
  return { groups: visible, hasMore: shown < total, remaining: total - shown }
}

export function windowDayGroups<T>(items: T[], dateOf: (item: T) => number, visibleCount: number): DayGroupWindow<T> {
  const groups = new Map<string, DayGroup<T>>()
  for (const item of items.slice(0, visibleCount)) {
    const date = new Date(dateOf(item))
    const key = formatCreationDate(date)
    const group = groups.get(key) ?? { key, date, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  return {
    groups: Array.from(groups.values()),
    hasMore: visibleCount < items.length,
    remaining: Math.max(0, items.length - visibleCount),
  }
}
