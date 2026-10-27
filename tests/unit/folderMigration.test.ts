import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {migrateFolder} from '../../src/main/src/utils/folderMigration'

describe('migrateFolder', () => {
  let root: string
  let legacy: string
  let current: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-folder-migration-'))
    legacy = path.join(root, '.dash-desktop')
    current = path.join(root, '.dash-desktop-wallet')
  })

  afterEach(() => {
    fs.rmSync(root, {recursive: true, force: true})
  })

  it('does nothing without a legacy folder', () => {
    expect(migrateFolder(legacy, current)).toEqual([])
    expect(fs.existsSync(current)).toBe(false)
  })

  it('renames the legacy folder when the current one is missing', () => {
    fs.mkdirSync(path.join(legacy, 'dev'), {recursive: true})
    fs.writeFileSync(path.join(legacy, 'storage.db'), 'wallets')
    fs.writeFileSync(path.join(legacy, 'storage.db-wal'), 'wal')
    fs.writeFileSync(path.join(legacy, 'dev', 'storage.db'), 'dev wallets')

    expect(migrateFolder(legacy, current)).toEqual([])

    expect(fs.readFileSync(path.join(current, 'storage.db'), 'utf-8')).toBe('wallets')
    expect(fs.readFileSync(path.join(current, 'storage.db-wal'), 'utf-8')).toBe('wal')
    expect(fs.readFileSync(path.join(current, 'dev', 'storage.db'), 'utf-8')).toBe('dev wallets')
    expect(fs.existsSync(legacy)).toBe(false)
  })

  it('merges into an empty current folder and removes the legacy one', () => {
    fs.mkdirSync(path.join(legacy, 'Local Storage', 'leveldb'), {recursive: true})
    fs.writeFileSync(path.join(legacy, 'Local Storage', 'leveldb', '000003.log'), 'settings')
    fs.mkdirSync(current)

    expect(migrateFolder(legacy, current)).toEqual([])

    expect(fs.readFileSync(path.join(current, 'Local Storage', 'leveldb', '000003.log'), 'utf-8')).toBe('settings')
    expect(fs.existsSync(legacy)).toBe(false)
  })

  it('leaves entries the current folder already has in the legacy folder', () => {
    fs.mkdirSync(legacy)
    fs.writeFileSync(path.join(legacy, 'storage.db'), 'old')
    fs.writeFileSync(path.join(legacy, 'preferences.json'), 'old')
    fs.mkdirSync(current)
    fs.writeFileSync(path.join(current, 'storage.db'), 'new')

    expect(migrateFolder(legacy, current)).toEqual(['storage.db'])

    expect(fs.readFileSync(path.join(current, 'storage.db'), 'utf-8')).toBe('new')
    expect(fs.readFileSync(path.join(legacy, 'storage.db'), 'utf-8')).toBe('old')
    expect(fs.readFileSync(path.join(current, 'preferences.json'), 'utf-8')).toBe('old')
  })
})
