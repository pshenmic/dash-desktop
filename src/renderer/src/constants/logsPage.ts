import { LogLevel } from '@renderer/types/Log'

export const LOG_LEVEL_OPTIONS: { value: LogLevel; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'error', label: 'Errors' },
  { value: 'warn', label: 'Warnings' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' }
]
export const INITIAL_LOG_LINES = 500
export const LOG_LINES_INCREMENT = 500
export const LOG_LINE_PATTERN = /^\[[^\]]+\]\s+\[(error|warn|info|debug|verbose|silly)\]/i
export const LOG_LINE_DISPLAY_OPTIONS: { value: 'scroll' | 'wrap'; label: string }[] = [
  { value: 'scroll', label: 'Scroll' },
  { value: 'wrap', label: 'Wrap' }
]
