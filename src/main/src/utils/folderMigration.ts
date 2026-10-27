import fs from 'fs'
import path from 'path'

// A whole-folder rename keeps a SQLite file and its -wal/-journal together.
// Merging entry by entry is the fallback for a target that already exists —
// Electron creates userData before main runs. Nothing is deleted: an entry the
// target already has stays behind in the legacy folder and is returned.
export const migrateFolder = (legacyPath: string, currentPath: string): string[] => {
  if (!fs.existsSync(legacyPath)) {
    return []
  }
  if (!fs.existsSync(currentPath)) {
    fs.mkdirSync(path.dirname(currentPath), {recursive: true})
    fs.renameSync(legacyPath, currentPath)
    return []
  }

  const leftovers: string[] = []
  for (const entry of fs.readdirSync(legacyPath)) {
    const target = path.join(currentPath, entry)
    if (fs.existsSync(target)) {
      leftovers.push(entry)
      continue
    }
    try {
      fs.renameSync(path.join(legacyPath, entry), target)
    } catch {
      leftovers.push(entry)
    }
  }

  if (leftovers.length === 0) {
    fs.rmdirSync(legacyPath)
  }
  return leftovers
}
