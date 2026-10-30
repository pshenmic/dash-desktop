import type { ReactNode, Ref } from 'react'
import type { IdentitySelectAppearance } from '../enums/IdentitySelectAppearance'
import type { IdentityApiDto } from '../hooks/useIdentities'

export interface IdentitySelectHandle {
  open: () => void
}

export interface IdentitySelectProps {
  identities: IdentityApiDto[]
  loading: boolean
  error: string | null
  selected: IdentityApiDto | undefined
  onSelect: (identifier: string) => void
  onRetry: () => void
  appearance?: IdentitySelectAppearance
  searchable?: boolean
  renderMeta?: (identity: IdentityApiDto) => ReactNode
  renderTriggerMeta?: (identity: IdentityApiDto) => ReactNode
  renderBadge?: (identity: IdentityApiDto) => ReactNode
  footer?: ReactNode
  attention?: boolean
  ariaLabel?: string
  ref?: Ref<IdentitySelectHandle>
}

export interface IdentitySelectPopoverProps {
  appearance: IdentitySelectAppearance
  identities: IdentityApiDto[]
  selected: IdentityApiDto | undefined
  searchable: boolean
  activateSelected: boolean
  renderMeta?: (identity: IdentityApiDto) => ReactNode
  renderBadge?: (identity: IdentityApiDto) => ReactNode
  footer?: ReactNode
  onSelect: (identifier: string) => void
  onDismiss: (restoreFocus: boolean) => void
}

export interface IdentityNameProps {
  identity: IdentityApiDto
}

export interface IdentityMetaProps {
  identity: IdentityApiDto
  meta: ReactNode
  warnEmpty?: boolean
}

export interface IdentitySelectStyles {
  trigger: string
  popover: string
  list: string
  option: string
}
