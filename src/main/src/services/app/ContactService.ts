import {ContactDAO} from '../../database/ContactDAO'
import {Contact, ContactKind} from '../../types/Contact'
import {Network} from '../../types/Network'

export class ContactService {
  private contactDAO: ContactDAO

  constructor(contactDAO: ContactDAO) {
    this.contactDAO = contactDAO
  }

  async getContacts(network?: Network): Promise<Contact[]> {
    return this.contactDAO.getContacts(network)
  }

  async addContact(label: string, address: string, network: Network, kind: ContactKind = 'core'): Promise<void> {
    const trimmedLabel = label.trim()
    const trimmedAddress = address.trim()

    if (trimmedLabel.length === 0) {
      throw new Error('Label is required')
    }
    if (trimmedAddress.length === 0) {
      throw new Error('Address is required')
    }
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('Invalid network')
    }

    if (kind !== 'core' && kind !== 'platform' && kind !== 'shielded' && kind !== 'identity') throw new Error('Invalid contact type')
    await this.contactDAO.insertContact(trimmedLabel, trimmedAddress, network, Date.now(), kind)
  }

  async deleteContact(id: number): Promise<void> {
    return this.contactDAO.deleteContact(id)
  }

  async updateContact(id: number, label: string, address: string, kind: ContactKind): Promise<void> {
    const trimmedLabel = label.trim()
    const trimmedAddress = address.trim()
    if (trimmedLabel.length === 0) throw new Error('Label is required')
    if (trimmedAddress.length === 0) throw new Error('Address is required')
    if (kind !== 'core' && kind !== 'platform' && kind !== 'shielded' && kind !== 'identity') throw new Error('Invalid contact type')
    await this.contactDAO.updateContact(id, trimmedLabel, trimmedAddress, kind)
  }
}
