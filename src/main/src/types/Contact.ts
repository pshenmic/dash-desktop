import {Network} from './Network'

export type ContactKind = 'core' | 'platform' | 'shielded' | 'identity'

export interface Contact {
  id: number
  label: string
  address: string
  network: Network
  kind: ContactKind
  createdAt: number
}
