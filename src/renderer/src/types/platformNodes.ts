import type {PeerMode} from '@renderer/api/types'

export type PlatformNodeTableTab = 'active' | 'static'

export interface PlatformNodeTableTabDefinition {
  value: PlatformNodeTableTab
  label: string
}

export interface PlatformNodeRow {
  id: string
  entry: string
  url: string
  driveVersion: string
  pingTime: string
  blockHeight: string
  status: string
  available: boolean
  proTxHash: string | null
  error: string | null
}

export interface PlatformNodeModeSelectorProps {
  mode: PeerMode | null
  disabled: boolean
  onChange: (mode: PeerMode) => void
}

export interface AddPlatformNodeFormProps {
  disabled: boolean
  onClose: () => void
  onSubmit: (url: string) => Promise<boolean>
}

export interface PlatformNodeRowProps {
  row: PlatformNodeRow
  removable: boolean
  disabled: boolean
  onRemove: (url: string) => void
}
