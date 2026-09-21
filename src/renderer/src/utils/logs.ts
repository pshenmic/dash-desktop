import { ParsedLogLine } from '@renderer/types/Log'
import { LogFileInfo } from '@renderer/api/types'
import { LOG_LINE_PATTERN } from '@renderer/constants/logsPage'

export const parseLogLines = (content: string): ParsedLogLine[] => {
  let previousLevel: ParsedLogLine['level'] = 'unknown'
  return content.split(/\r?\n/)
    .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
    .map((raw, index) => {
      const match = raw.match(LOG_LINE_PATTERN)
      const value = match?.[1]?.toLowerCase()
      const level: ParsedLogLine['level'] = value === 'verbose' || value === 'silly'
        ? 'debug'
        : value === 'error' || value === 'warn' || value === 'info' || value === 'debug'
          ? value
          : previousLevel
      previousLevel = level
      return { number: index + 1, raw, level }
    })
}

export const currentLogFile = (files: LogFileInfo[]): LogFileInfo | undefined =>
  files.filter((file) => !file.rotated).sort((a, b) => b.name.localeCompare(a.name))[0]

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
