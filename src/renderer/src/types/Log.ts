export type LogLevel = 'all' | 'error' | 'warn' | 'info' | 'debug' | 'unknown'

export interface ParsedLogLine {
  number: number
  raw: string
  level: Exclude<LogLevel, 'all'>
}
