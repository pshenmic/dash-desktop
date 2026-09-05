import {inspect} from 'node:util'
import {DEFAULT_LOG_LEVEL, LOG_LEVELS, LOG_REPLACEMENT_PATTERNS} from '../constants/logging'
import {LoggerOptions, LogLevel} from '../types/Log'

let threshold: LogLevel = DEFAULT_LOG_LEVEL
let levelPrefix = false

export function configureLogger(options: LoggerOptions): void {
  if (options.level != null) threshold = options.level
  if (options.levelPrefix != null) levelPrefix = options.levelPrefix
}

export function currentLogLevel(): LogLevel {
  return threshold
}

const describe = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`
  if (typeof value === 'bigint') return `${value}n`
  if (value === null || typeof value !== 'object') return String(value)
  return inspect(value, {depth: 4, breakLength: Infinity})
}

export function replaceSecrets(line: string): string {
  let result = line
  for (const {pattern, replacement} of LOG_REPLACEMENT_PATTERNS) {
    // Shared module-level regexes carry lastIndex between calls when global.
    pattern.lastIndex = 0
    result = result.replace(pattern, replacement)
  }
  return result
}


export class Logger {
  constructor(private readonly scope: string) {}

  error(...args: unknown[]): void {
    this.write('error', args)
  }

  warn(...args: unknown[]): void {
    this.write('warn', args)
  }

  info(...args: unknown[]): void {
    this.write('info', args)
  }

  debug(...args: unknown[]): void {
    this.write('debug', args)
  }

  private write(level: LogLevel, args: unknown[]): void {
    if (LOG_LEVELS.indexOf(level) > LOG_LEVELS.indexOf(threshold)) return

    const head = levelPrefix ? `[${level}] ` : ''
    const line = `${head}[${this.scope}] ${replaceSecrets(args.map(describe).join(' '))}`

    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else if (level === 'debug') console.debug(line)
    else console.info(line)
  }
}
