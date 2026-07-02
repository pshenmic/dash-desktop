import { ConnectionType, Contact, ExchangeRatesResult, Network, PlatformAddressDto, PlatformSendResult, PreferencesJSON, QueryStatus, SendResult, ShieldResult, ShieldedPoolInfo, ShieldedStatus, ShieldedSyncState } from './types'

export class API {
  private static get api() {
    return window.electronAPI
  }

  static async getPreferences(): Promise<PreferencesJSON> {
    return this.api.getPreferences() as Promise<PreferencesJSON>
  }

  static async setConnectionType(connectionType: ConnectionType): Promise<QueryStatus> {
    return this.api.setConnectionType(connectionType) as Promise<QueryStatus>
  }

  static async setFiatCurrency(currency: string): Promise<QueryStatus> {
    return this.api.setFiatCurrency(currency) as Promise<QueryStatus>
  }

  static async startWalletSync(walletId: string): Promise<QueryStatus> {
    return this.api.startWalletSync(walletId) as Promise<QueryStatus>
  }

  static async stopWalletSync(): Promise<void> {
    return this.api.stopWalletSync()
  }

  static async resetWalletSync(network: 'mainnet' | 'testnet'): Promise<void> {
    await this.api.resetWalletSync(network)
  }

  static async hasSyncProgress(walletId: string): Promise<boolean> {
    return this.api.hasSyncProgress(walletId) as Promise<boolean>
  }

  static async createWallet(seedphrase: string, network: string, password: string): Promise<string> {
    return this.api.createWallet(seedphrase, network, password) as Promise<string>
  }

  static async getAddresses(walletId: string) {
    return this.api.getAddresses(walletId)
  }

  static async getReceiveAddress(walletId: string): Promise<string | null> {
    return this.api.getReceiveAddress(walletId)
  }

  static async getStatus() {
    return this.api.getStatus()
  }

  static async getAllWallets() {
    return this.api.getAllWallets()
  }

  static async setWalletLabel(walletId: string, label: string | null): Promise<QueryStatus> {
    return this.api.setWalletLabel(walletId, label) as Promise<QueryStatus>
  }

  static async getTransactions(walletId: string) {
    return this.api.getTransactions(walletId)
  }

  static async getIdentities(walletId: string) {
    return this.api.getIdentities(walletId)
  }

  static async getPlatformAddresses(walletId: string): Promise<PlatformAddressDto[]> {
    return this.api.getPlatformAddresses(walletId) as Promise<PlatformAddressDto[]>
  }

  static async deleteWallet(walletId: string) {
    return this.api.deleteWallet(walletId)
  }

  static async selectWallet(walletId: string) {
    return this.api.selectWallet(walletId)
  }

  static async getWalletBalance(walletId: string) {
    return this.api.getWalletBalance(walletId)
  }

  static async verifyWalletPassword(walletId: string, password: string) {
    return this.api.verifyWalletPassword(walletId, password)
  }

  static async exportMnemonic(walletId: string, password: string): Promise<string> {
    return this.api.exportMnemonic(walletId, password)
  }

  static async getExchangeRates(): Promise<ExchangeRatesResult> {
    return this.api.getExchangeRates() as Promise<ExchangeRatesResult>
  }

  static async saveTextFile(defaultFileName: string, content: string): Promise<QueryStatus> {
    return this.api.saveTextFile(defaultFileName, content) as Promise<QueryStatus>
  }

  static async getContacts(network?: Network): Promise<Contact[]> {
    return this.api.getContacts(network) as Promise<Contact[]>
  }

  static async addContact(label: string, address: string, network: Network): Promise<QueryStatus> {
    return this.api.addContact(label, address, network) as Promise<QueryStatus>
  }

  static async deleteContact(id: number): Promise<QueryStatus> {
    return this.api.deleteContact(id) as Promise<QueryStatus>
  }

  static async sendTransaction(walletId: string, toAddress: string, amountDuffs: string, password: string): Promise<SendResult> {
    return this.api.sendTransaction(walletId, toAddress, amountDuffs, password) as Promise<SendResult>
  }

  static async getShieldedStatus(): Promise<ShieldedStatus> {
    return this.api.getShieldedStatus() as Promise<ShieldedStatus>
  }

  static async getShieldedPoolInfo(network: Network): Promise<ShieldedPoolInfo> {
    return this.api.getShieldedPoolInfo(network) as Promise<ShieldedPoolInfo>
  }

  static async startShieldedSync(walletId: string, password: string): Promise<ShieldedSyncState> {
    return this.api.startShieldedSync(walletId, password) as Promise<ShieldedSyncState>
  }

  static async getShieldedSyncState(walletId: string): Promise<ShieldedSyncState> {
    return this.api.getShieldedSyncState(walletId) as Promise<ShieldedSyncState>
  }

  static async sendPlatformTransfer(walletId: string, fromAddress: string, toAddress: string, amountCredits: string, password: string): Promise<PlatformSendResult> {
    return this.api.sendPlatformTransfer(walletId, fromAddress, toAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async shieldToPool(walletId: string, fromAddress: string, amountCredits: string, password: string): Promise<ShieldResult> {
    return this.api.shieldToPool(walletId, fromAddress, amountCredits, password) as Promise<ShieldResult>
  }
}
