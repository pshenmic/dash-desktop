export interface SqliteConnection {
  run: (sql: string, callback: (err: Error | null) => void) => void
}