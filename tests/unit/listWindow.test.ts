import { describe, expect, it } from 'vitest'
import { windowDayGroups, windowGroups, windowList } from '../../src/renderer/src/utils/listWindow'
import type { ListGroup } from '../../src/renderer/src/types/ListWindow'

const range = (length: number): number[] => Array.from({ length }, (_, index) => index)

function group(key: string, items: number[]): ListGroup<number> {
  return { key, label: key, items, total: items.length }
}

describe('windowList', () => {
  it('reveals the first page and says how many remain', () => {
    expect(windowList(range(214), 50)).toMatchObject({ hasMore: true, remaining: 164 })
    expect(windowList(range(214), 50).items).toHaveLength(50)
    expect(windowList(range(3), 50)).toEqual({ items: [0, 1, 2], hasMore: false, remaining: 0 })
  })
})

describe('windowGroups', () => {
  const groups = [group('requests', range(12)), group('contacts', range(186)), group('sent', range(16))]

  it('fills groups in order and keeps each group’s full total', () => {
    const view = windowGroups(groups, 50)
    expect(view.groups.map(entry => [entry.key, entry.items.length, entry.total])).toEqual([['requests', 12, 12], ['contacts', 38, 186]])
    expect(view).toMatchObject({ hasMore: true, remaining: 164 })
  })

  it('drops groups with nothing visible and stops once everything is shown', () => {
    expect(windowGroups(groups, 12).groups.map(entry => entry.key)).toEqual(['requests'])
    expect(windowGroups(groups, 500)).toMatchObject({ hasMore: false, remaining: 0 })
    expect(windowGroups(groups, 500).groups).toHaveLength(3)
    expect(windowGroups([], 50)).toEqual({ groups: [], hasMore: false, remaining: 0 })
  })
})

describe('windowDayGroups', () => {
  const day = (date: number, hour: number) => new Date(2026, 9, date, hour).getTime()
  const payments = [day(22, 15), day(22, 9), day(8, 12), day(8, 11), day(1, 10)].map(date => ({ date }))

  it('groups the visible items by calendar day, newest first as given', () => {
    const view = windowDayGroups(payments, payment => payment.date, 4)
    expect(view.groups.map(entry => [entry.key, entry.items.length])).toEqual([['22 Oct 2026', 2], ['8 Oct 2026', 2]])
    expect(view.groups[0].date.getTime()).toBe(day(22, 15))
    expect(view).toMatchObject({ hasMore: true, remaining: 1 })
  })

  it('shows every day once the window covers all items', () => {
    expect(windowDayGroups(payments, payment => payment.date, 50).groups).toHaveLength(3)
  })
})
