import type { IdentityApiDto } from '@renderer/hooks/useIdentities'

export interface IdentityRowProps {
  identity: IdentityApiDto
  onOpen: (identifier: string) => void
}

export interface IdentityDetailProps {
  walletId: string
  identifier: string
}
