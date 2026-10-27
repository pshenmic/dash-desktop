import os from 'os'
import path from 'path'
import fs from 'fs'
import {DevFolderName, HomeFolderName, LegacyHomeFolderName} from '../constants/app'

export const homeFolderPath = (): string => path.join(os.homedir(), HomeFolderName)

export const legacyHomeFolderPath = (): string => path.join(os.homedir(), LegacyHomeFolderName)

// A dev run nests one level deeper so it cannot corrupt — or be migrated
// against — the installed wallet's data. electron-vite replaces this at build
// time, so a packaged app is unconditionally the outer folder.
export const dataPath = (...segments: string[]): string =>
  import.meta.env.DEV
    ? path.join(homeFolderPath(), DevFolderName, ...segments)
    : path.join(homeFolderPath(), ...segments)

export const ensureDataFolder = (): void => {
  fs.mkdirSync(dataPath(), {recursive: true})
}
