import type { ParsedLogLine } from '../types/Log'

export const LOG_LINE_LEVEL_CLASS: Record<ParsedLogLine['level'], string> = {
  error: 'text-dash-red dark:text-[color-mix(in_srgb,var(--color-dash-red)_60%,white)]',
  warn: 'text-dash-orange',
  info: '',
  debug: 'opacity-50',
  unknown: '',
}

export const LOG_VIEWER_EMPTY_TEXTS = {
  noCurrentLog: 'No current log is available yet',
  emptyLogFile: 'This log file is empty',
  noPreviousLogs: 'No previous logs',
} as const

export const LOG_VIEWER_BORDER ='border-dash-primary-dark-blue/12 dark:border-white/12'

export const LOG_VIEWER_SECONDARY_TEXT = 'text-dash-primary-dark-blue/50 dark:text-white/50'
