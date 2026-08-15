import {Network} from './Network'

export interface Contact {
  id: number
  label: string
  address: string
  network: Network
  createdAt: number
}
