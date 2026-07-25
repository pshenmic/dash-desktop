import { AssetLockFundingKind, AssetLockFundingState, ConnectionType, Contact, ExchangeRatesResult, IdentityCreateResult, Network, PlatformAddressDto, PlatformSendResult, PreferencesJSON, QueryStatus, SendResult, ShieldResult, ShieldedNotesInfo, ShieldedPoolInfo, ShieldedSpendState, ShieldedStatus, ShieldedSyncState, TxLockStatus } from './types'

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

  static async addWalletAddress(walletId: string, password: string, isChange: boolean): Promise<string> {
    return this.api.addWalletAddress(walletId, password, isChange)
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

  static async addPlatformAddress(walletId: string): Promise<PlatformAddressDto[]> {
    return this.api.addPlatformAddress(walletId) as Promise<PlatformAddressDto[]>
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

  static async verifyWalletMnemonic(walletId: string, mnemonic: string): Promise<boolean> {
    return this.api.verifyWalletMnemonic(walletId, mnemonic)
  }

  static async resetWalletPassword(walletId: string, mnemonic: string, newPassword: string): Promise<boolean> {
    return this.api.resetWalletPassword(walletId, mnemonic, newPassword)
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

  static async sendTransaction(walletId: string, toAddress: string, amountDuffs: string, password: string, fromAddress?: string): Promise<SendResult> {
    return this.api.sendTransaction(walletId, toAddress, amountDuffs, password, fromAddress) as Promise<SendResult>
  }

  static async getTxLockStatus(walletId: string, txid: string): Promise<TxLockStatus> {
    return this.api.getTxLockStatus(walletId, txid) as Promise<TxLockStatus>
  }

  static async getShieldedStatus(): Promise<ShieldedStatus> {
    return this.api.getShieldedStatus() as Promise<ShieldedStatus>
  }

  static async getShieldedPoolInfo(network: Network): Promise<ShieldedPoolInfo> {
    return this.api.getShieldedPoolInfo(network) as Promise<ShieldedPoolInfo>
  }

  static async getShieldedNotesInfo(walletId: string): Promise<ShieldedNotesInfo> {
    return this.api.getShieldedNotesInfo(walletId) as Promise<ShieldedNotesInfo>
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

  static async topUpIdentityFromAddresses(walletId: string, identityId: string, fromAddress: string | null, amountCredits: string, password: string): Promise<PlatformSendResult> {
    return this.api.topUpIdentityFromAddresses(walletId, identityId, fromAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async withdrawPlatformCredits(walletId: string, fromAddress: string | null, toCoreAddress: string, amountCredits: string, password: string): Promise<PlatformSendResult> {
    return this.api.withdrawPlatformCredits(walletId, fromAddress, toCoreAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async sendIdentityCredits(walletId: string, identityId: string, toAddress: string, amountCredits: string, password: string): Promise<PlatformSendResult> {
    return this.api.sendIdentityCredits(walletId, identityId, toAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async transferIdentityCredits(walletId: string, fromIdentityId: string, toIdentityId: string, amountCredits: string, password: string): Promise<PlatformSendResult> {
    return this.api.transferIdentityCredits(walletId, fromIdentityId, toIdentityId, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async withdrawIdentityCredits(walletId: string, identityId: string, toCoreAddress: string, amountCredits: string, password: string): Promise<PlatformSendResult> {
    return this.api.withdrawIdentityCredits(walletId, identityId, toCoreAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async createIdentityFromAddresses(walletId: string, fromAddress: string | null, amountCredits: string, password: string): Promise<IdentityCreateResult> {
    return this.api.createIdentityFromAddresses(walletId, fromAddress, amountCredits, password) as Promise<IdentityCreateResult>
  }

  static async startAssetLockFunding(walletId: string, toPlatformAddress: string, amountDuffs: string, password: string, kind: AssetLockFundingKind = AssetLockFundingKind.Address): Promise<AssetLockFundingState> {
    return this.api.startAssetLockFunding(walletId, toPlatformAddress, amountDuffs, password, kind) as Promise<AssetLockFundingState>
  }

  static async getAssetLockFundingState(walletId: string): Promise<AssetLockFundingState> {
    return this.api.getAssetLockFundingState(walletId) as Promise<AssetLockFundingState>
  }

  static async resumeAssetLockFunding(walletId: string, password: string): Promise<AssetLockFundingState> {
    return this.api.resumeAssetLockFunding(walletId, password) as Promise<AssetLockFundingState>
  }

  static async shieldToPool(walletId: string, fromAddress: string, toAddress: string, amountCredits: string, password: string): Promise<ShieldResult> {
    return this.api.shieldToPool(walletId, fromAddress, toAddress, amountCredits, password) as Promise<ShieldResult>
  }

  static async startShieldedTransfer(walletId: string, recipient: string, amountCredits: string, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.api.startShieldedTransfer(walletId, recipient, amountCredits, password, noteIndexes) as Promise<ShieldedSpendState>
  }

  static async startShieldedUnshield(walletId: string, outputAddress: string, amountCredits: string, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.api.startShieldedUnshield(walletId, outputAddress, amountCredits, password, noteIndexes) as Promise<ShieldedSpendState>
  }

  static async startShieldedWithdrawal(walletId: string, coreAddress: string, amountCredits: string, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.api.startShieldedWithdrawal(walletId, coreAddress, amountCredits, password, noteIndexes) as Promise<ShieldedSpendState>
  }

  static async startShieldedIdentityCreate(walletId: string, denominationCredits: string, password: string): Promise<ShieldedSpendState> {
    return this.api.startShieldedIdentityCreate(walletId, denominationCredits, password) as Promise<ShieldedSpendState>
  }

  static async getShieldedSpendState(walletId: string): Promise<ShieldedSpendState> {
    return this.api.getShieldedSpendState(walletId) as Promise<ShieldedSpendState>
  }

  static async getShieldedAddress(walletId: string, password?: string): Promise<string | null> {
    return this.api.getShieldedAddress(walletId, password) as Promise<string | null>
  }

  static async getShieldedAddresses(walletId: string, password?: string): Promise<string[] | null> {
    return this.api.getShieldedAddresses(walletId, password) as Promise<string[] | null>
  }

  static async addShieldedAddress(walletId: string, password: string): Promise<string[]> {
    return this.api.addShieldedAddress(walletId, password) as Promise<string[]>
  }
}
