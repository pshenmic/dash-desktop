export interface LogFileInfo {
  name: string
  size: number
  modifiedAt: number
  rotated: boolean
}

export interface LogFileContent extends LogFileInfo {
  content: string
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface LoggerOptions {
  level?: LogLevel
  // Set by a process whose stdout the parent re-logs: the parent cannot see
  // console.info from console.warn once both are bytes on a pipe, so the level
  // rides along at the head of the line and is stripped again on arrival.
  levelPrefix?: boolean
}
