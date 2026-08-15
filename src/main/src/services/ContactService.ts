import {ContactDAO} from '../database/ContactDAO'
import {Contact} from '../types/Contact'
import {Network} from '../types/Network'
import {QueryStatus} from '../types/QueryStatus'

export class ContactService {
  private contactDAO: ContactDAO

  constructor(contactDAO: ContactDAO) {
    this.contactDAO = contactDAO
  }

  async getContacts(network?: Network): Promise<Contact[]> {
    return this.contactDAO.getContacts(network)
  }

  async addContact(label: string, address: string, network: Network): Promise<QueryStatus> {
    const trimmedLabel = label.trim()
    const trimmedAddress = address.trim()

    if (trimmedLabel.length === 0) {
      return {success: false, errorMessage: 'Label is required'}
    }
    if (trimmedAddress.length === 0) {
      return {success: false, errorMessage: 'Address is required'}
    }
    if (network !== 'mainnet' && network !== 'testnet') {
      return {success: false, errorMessage: 'Invalid network'}
    }

    return this.contactDAO.insertContact(trimmedLabel, trimmedAddress, network, Date.now())
  }

  async deleteContact(id: number): Promise<QueryStatus> {
    return this.contactDAO.deleteContact(id)
  }
}
