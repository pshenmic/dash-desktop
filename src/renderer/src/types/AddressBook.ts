import type { Contact, ContactKind } from '../api/types'
import type { ReactNode } from 'react'

export type AddressUsage = 'all' | 'used' | 'balance'

export interface AddressListProps {
  coreGated?: boolean
  contacts?: Contact[]
  onSaveAddress?: (address: string) => void
}

export interface ShieldedAddressTabProps {
  walletId: string | undefined
  usage?: AddressUsage
  search?: string
  contacts?: Contact[]
  renderAction?: (address: string) => ReactNode
}

export interface ContactEditModalProps {
  contact?: Contact
  address?: string
  owned: Set<string>
  onClose: () => void
  onSave: (label: string, address: string, kind: ContactKind) => Promise<void>
}
