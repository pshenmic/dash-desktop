import { describe, expect, it } from 'vitest'
import { filterLogLines, formatFileSize, newestLogWindow, parseLogLines } from '../../src/renderer/src/utils/logs'

describe('log viewer helpers', () => {
  const lines = parseLogLines([
    '[2026-08-12 10:00:00.000] [info] started',
    '[2026-08-12 10:00:01.000] [error](p2p) connection failed',
    '[2026-08-12 10:00:02.000] [warn] retrying',
    'continuation line'
  ].join('\n'))

  it('parses levels and preserves raw lines and line numbers', () => {
    expect(lines.map((line) => line.level)).toEqual(['info', 'error', 'warn', 'warn'])
    expect(lines[1]).toMatchObject({ number: 2, raw: expect.stringContaining('connection failed') })
  })

  it('combines a case-insensitive query with the level filter', () => {
    expect(filterLogLines(lines, 'CONNECTION', 'error').map((line) => line.number)).toEqual([2])
    expect(filterLogLines(lines, 'retry', 'error')).toEqual([])
  })

  it('keeps stack trace lines with the preceding entry level', () => {
    const error = parseLogLines('[2026-08-12 10:00:00.000] [error] failed\n    at handler.ts:10')
    expect(filterLogLines(error, '', 'error')).toHaveLength(2)
  })

  it('formats file sizes', () => {
    expect(formatFileSize(12)).toBe('12 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('keeps the newest window of filtered lines', () => {
    expect(newestLogWindow(lines, 2).map((line) => line.number)).toEqual([3, 4])
  })
})
