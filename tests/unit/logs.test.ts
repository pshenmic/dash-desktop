import { describe, expect, it } from 'vitest'
import { currentLogFile, formatFileSize, parseLogLines } from '../../src/renderer/src/utils/logs'

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

  it('keeps stack trace lines with the preceding entry level', () => {
    const error = parseLogLines('[2026-08-12 10:00:00.000] [error] failed\n    at handler.ts:10')
    expect(error.map((line) => line.level)).toEqual(['error', 'error'])
  })

  it('formats file sizes', () => {
    expect(formatFileSize(12)).toBe('12 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('preserves the entire log beyond the former display limit', () => {
    const content = Array.from({ length: 1200 }, (_, index) => `Line ${index + 1}`).join('\n')
    const parsed = parseLogLines(content)
    expect(parsed).toHaveLength(1200)
    expect(parsed.map((line) => line.raw).join('\n')).toBe(content)
  })

  it('follows the newest active file even if a rotated or older file was modified later', () => {
    const files = [
      { name: 'wallet-2026-09-21.old.log', rotated: true, size: 100, modifiedAt: 3 },
      { name: 'wallet-2026-09-20.log', rotated: false, size: 100, modifiedAt: 2 },
      { name: 'wallet-2026-09-21.log', rotated: false, size: 0, modifiedAt: 1 }
    ]
    expect(currentLogFile(files)).toBe(files[2])
    expect(currentLogFile([files[0]])).toBeUndefined()
    expect(currentLogFile([])).toBeUndefined()
  })
})
