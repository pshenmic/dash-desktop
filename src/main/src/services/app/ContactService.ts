import {ContactDAO} from '../../database/ContactDAO'
import {Contact} from '../../types/Contact'
import {Network} from '../../types/Network'

export class ContactService {
  private contactDAO: ContactDAO

  constructor(contactDAO: ContactDAO) {
    this.contactDAO = contactDAO
  }

  async getContacts(network?: Network): Promise<Contact[]> {
    return this.contactDAO.getContacts(network)
  }

  async addContact(label: string, address: string, network: Network): Promise<void> {
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

    await this.contactDAO.insertContact(trimmedLabel, trimmedAddress, network, Date.now())
  }

  async deleteContact(id: number): Promise<void> {
    return this.contactDAO.deleteContact(id)
  }
}
