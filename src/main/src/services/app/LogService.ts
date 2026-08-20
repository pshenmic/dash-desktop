import fs from 'fs/promises'
import path from 'path'
import { LOG_FILE_NAME_PATTERN } from '../../constants'
import { LogFileContent, LogFileInfo } from '../../types/Log'

export class LogService {
  constructor(private readonly logsDir: string) {}

  async listFiles(): Promise<LogFileInfo[]> {
    let entries
    try {
      entries = await fs.readdir(this.logsDir, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const files = await Promise.all(entries
      .filter((entry) => entry.isFile() && LOG_FILE_NAME_PATTERN.test(entry.name))
      .map(async (entry) => {
        try {
          const stats = await fs.lstat(path.join(this.logsDir, entry.name))
          if (!stats.isFile() || stats.isSymbolicLink()) return null
          return {
            name: entry.name,
            size: stats.size,
            modifiedAt: stats.mtimeMs,
            rotated: entry.name.endsWith('.old.log')
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
          throw error
        }
      }))

    return files
      .filter((file): file is LogFileInfo => file !== null)
      .sort((a, b) => b.modifiedAt - a.modifiedAt || b.name.localeCompare(a.name))
  }

  async readFile(name: string): Promise<LogFileContent> {
    const source = this.resolveFile(name)
    const stats = await fs.lstat(source)
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('Log file is not a regular file')
    const content = await fs.readFile(source, 'utf8')
    return { name, content, size: stats.size, modifiedAt: stats.mtimeMs, rotated: name.endsWith('.old.log') }
  }

  async getFilePath(name: string): Promise<string> {
    const source = this.resolveFile(name)
    const stats = await fs.lstat(source)
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('Log file is not a regular file')
    return source
  }

  validateFileName(name: string): void {
    if (!LOG_FILE_NAME_PATTERN.test(name)) throw new Error('Invalid log file name')
  }

  private resolveFile(name: string): string {
    this.validateFileName(name)
    return path.join(this.logsDir, name)
  }
}
