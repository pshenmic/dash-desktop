export interface LogFileInfo {
  name: string
  size: number
  modifiedAt: number
  rotated: boolean
}

export interface LogFileContent extends LogFileInfo {
  content: string
}
