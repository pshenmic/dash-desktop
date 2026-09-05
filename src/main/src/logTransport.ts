import log from 'electron-log/main'
import fs from 'fs'
import path from 'path'
import {LogsFolderName} from './constants/app'
import {LOG_FILE_MAX_SIZE, LOG_LEVELS, LOG_RETENTION_DAYS} from './constants/logging'
import {LogLevel} from './types/Log'
import {dataPath} from './utils/dataPath'
import {configureLogger, replaceSecrets} from './utils/logger'

const logsDir = dataPath(LogsFolderName)

const dateStamp = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const deleteLogsOlderThan = (days: number): void => {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  let entries: string[]
  try {
    entries = fs.readdirSync(logsDir)
  } catch {
    return
  }
  for (const name of entries) {
    if (!name.startsWith('wallet-') || !name.endsWith('.log')) continue
    const full = path.join(logsDir, name)
    try {
      if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full)
    } catch {
      // ignore files that vanished or can't be stat'd
    }
  }
}

let initialized = false

/**
 * Route all main-process logging to a dated file under the wallet folder while
 * keeping terminal output. Patches `console.*` so third-party output (SDK,
 * Knex) is captured alongside {@link Logger} call sites. Utility-process output
 * is forwarded via {@link logChildOutput}. Safe to call more than once.
 */
export function initLogTransport (): void {
  if (initialized) return
  initialized = true

  fs.mkdirSync(logsDir, { recursive: true })
  deleteLogsOlderThan(LOG_RETENTION_DAYS)

  log.transports.file.resolvePathFn = () =>
    path.join(logsDir, `wallet-${dateStamp(new Date())}.log`)
  log.transports.file.maxSize = LOG_FILE_MAX_SIZE
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}'

  // Catches what a Logger call site cannot: console.* from dependencies, and
  // child output that reached us as raw bytes rather than through a Logger.
  log.hooks.push(message => {
    message.data = message.data.map(item => typeof item === 'string' ? replaceSecrets(item) : item)
    return message
  })

  log.initialize()

  // Capture existing console.* call sites across the main process.
  Object.assign(console, log.functions)
}

/**
 * Set the level for everything the main process writes — both {@link Logger}
 * call sites and the third-party `console.*` output electron-log captures.
 */
export function applyLogLevel(level: LogLevel): void {
  configureLogger({level})
  log.transports.file.level = level
  log.transports.console.level = level
}

const CHILD_LEVEL_PATTERN = new RegExp(`^\\[(${LOG_LEVELS.join('|')})\\] `)

/**
 * Forward a chunk of a utility process's stdout/stderr to the same log file
 * (and terminal), tagged with its scope. The child already flushes to the
 * main-process streams; this adds the file sink.
 */
export function logChildOutput (scope: 'p2p' | 'platform', text: string, isError: boolean): void {
  const trimmed = text.replace(/\r?\n$/, '')
  if (trimmed.length === 0) return
  const scoped = log.scope(scope)
  // Per line, not per chunk: a child flushes several lines in one write, and
  // logging the chunk whole stamps only the first — the rest land bare, so the
  // file cannot be filtered by time or level.
  for (const line of trimmed.split('\n')) {
    // A child's own level survives as a prefix its Logger stamped; the stream
    // it arrived on only distinguishes error from everything else.
    const match = line.match(CHILD_LEVEL_PATTERN)
    if (match) scoped[match[1] as LogLevel](line.slice(match[0].length))
    else if (isError) scoped.error(line)
    else scoped.info(line)
  }
}
