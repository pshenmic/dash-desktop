import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { LogService } from '../../src/main/src/services/app/LogService'

describe('LogService', () => {
  let directory: string
  let service: LogService

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dash-log-service-'))
    service = new LogService(directory)
  })

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('lists only valid regular log files with newest first', async () => {
    const oldName = 'wallet-2026-08-11.old.log'
    const newName = 'wallet-2026-08-12.log'
    await fs.writeFile(path.join(directory, oldName), 'old')
    await fs.writeFile(path.join(directory, newName), 'new content')
    await fs.writeFile(path.join(directory, 'notes.txt'), 'ignore')
    await fs.mkdir(path.join(directory, 'wallet-2026-08-10.log'))
    await fs.utimes(path.join(directory, oldName), new Date(1_000), new Date(1_000))
    await fs.utimes(path.join(directory, newName), new Date(2_000), new Date(2_000))

    await expect(service.listFiles()).resolves.toEqual([
      { name: newName, size: 11, modifiedAt: 2_000, rotated: false },
      { name: oldName, size: 3, modifiedAt: 1_000, rotated: true }
    ])
  })

  it('reads content and metadata', async () => {
    const name = 'wallet-2026-08-12.log'
    await fs.writeFile(path.join(directory, name), 'Привет')
    const result = await service.readLogFile(name)
    expect(result.name).toBe(name)
    expect(result.content).toBe('Привет')
    expect(result.size).toBe(Buffer.byteLength('Привет'))
    expect(result.rotated).toBe(false)
  })

  it('returns the path of a regular log file', async () => {
    const name = 'wallet-2026-08-12.log'
    const filePath = path.join(directory, name)
    await fs.writeFile(filePath, 'log')

    await expect(service.getFilePath(name)).resolves.toBe(filePath)
  })

  it('rejects a directory with a valid log file name', async () => {
    const name = 'wallet-2026-08-12.log'
    await fs.mkdir(path.join(directory, name))

    await expect(service.getFilePath(name)).rejects.toThrow('Log file is not a regular file')
  })

  it.each(['../wallet-2026-08-12.log', 'C:\\wallet-2026-08-12.log', 'wallet.log', 'wallet-2026-08-12.log/other'])(
    'rejects unsafe or invalid name %s',
    async (name) => expect(service.readLogFile(name)).rejects.toThrow('Invalid log file name')
  )

  it('returns an empty list when the directory does not exist', async () => {
    await expect(new LogService(path.join(directory, 'missing')).listFiles()).resolves.toEqual([])
  })
})
