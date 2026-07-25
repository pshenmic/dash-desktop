import log from 'electron-log/main'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  HomeFolderName,
  LogsFolderName,
  LOG_FILE_MAX_SIZE,
  LOG_RETENTION_DAYS
} from './constants'

const logsDir = path.join(os.homedir(), HomeFolderName, LogsFolderName)

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
 * keeping terminal output. Patches `console.*` so existing call sites are
 * captured without changes. Utility-process output is forwarded via
 * {@link logChildOutput}. Safe to call more than once.
 */
export function initLogger (): void {
  if (initialized) return
  initialized = true

  fs.mkdirSync(logsDir, { recursive: true })
  deleteLogsOlderThan(LOG_RETENTION_DAYS)

  log.transports.file.resolvePathFn = () =>
    path.join(logsDir, `wallet-${dateStamp(new Date())}.log`)
  log.transports.file.maxSize = LOG_FILE_MAX_SIZE
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}'

  log.initialize()

  // Capture existing console.* call sites across the main process.
  Object.assign(console, log.functions)
}

/**
 * Forward a chunk of a utility process's stdout/stderr to the same log file
 * (and terminal), tagged with its scope. The child already flushes to the
 * main-process streams; this adds the file sink.
 */
export function logChildOutput (scope: 'p2p' | 'shielded', text: string, isError: boolean): void {
  const trimmed = text.replace(/\r?\n$/, '')
  if (trimmed.length === 0) return
  const scoped = log.scope(scope)
  if (isError) scoped.error(trimmed)
  else scoped.info(trimmed)
}