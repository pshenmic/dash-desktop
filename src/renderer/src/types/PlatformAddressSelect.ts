import type { PlatformAddressDto } from '../api/types'

export interface PlatformAddressSelectProps {
  addresses: PlatformAddressDto[]
  selected: PlatformAddressDto | undefined
  onSelect: (platformAddress: string) => void
  automaticLabel?: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}
