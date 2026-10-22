import type { ReactNode } from 'react'
import type { DestinationKind } from '../enums/DestinationKind'
import type { DropdownFieldOption } from './DropdownField'

export interface EndpointKindIconProps {
  kind: string
}

export interface EndpointKindEntry {
  kind: string
  label: string
}

export interface DestinationPickerProps {
  kind: DestinationKind
  kinds: EndpointKindEntry[]
  onKindChange: (kind: DestinationKind) => void
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  error: string | null
  showValueInput: boolean
  validate: (address: string) => boolean
  ownOptions?: DropdownFieldOption[]
  ownOptionsLoading?: boolean
  ownOptionsError?: string | null
  onRetryOwnOptions?: () => void
  ownedAddresses?: ReadonlySet<string>
  compact?: boolean
  trailingControl?: ReactNode
}
