import { WalletTxDto } from '@renderer/types/WalletTransaction'
import { TransferOperation } from '../enums/TransferOperation'
import { AssetLockFundingKind, AssetLockFundingState, ConnectionType, Contact, CoreSpendSource, ExchangeRatesResult, IdentityCreateResult, LogFileContent, LogFileInfo, Network, PlatformAddressDto, PlatformSendResult, PreferencesJSON, SelectableUtxo, SendResult, ShieldResult, ShieldedNotesInfo, ShieldedPoolInfo, ShieldedSpendState, ShieldedStatus, ShieldedSyncState, FeeParams, OperationFee, Transaction, TxLockStatus } from './types'

export class API {
  private static get api() {
    return window.electronAPI
  }

  static async getPreferences(): Promise<PreferencesJSON> {
    return this.api.getPreferences() as Promise<PreferencesJSON>
  }

  static async setConnectionType(connectionType: ConnectionType): Promise<void> {
    return this.api.setConnectionType(connectionType)
  }

  static async setFiatCurrency(currency: string): Promise<void> {
    return this.api.setFiatCurrency(currency)
  }

  static async setPlatformFeeMultiplier(platformFeeMultiplier: number): Promise<void> {
    return this.api.setPlatformFeeMultiplier(platformFeeMultiplier)
  }

  static async setCoreFeeMultiplier(coreFeeMultiplier: number): Promise<void> {
    return this.api.setCoreFeeMultiplier(coreFeeMultiplier)
  }

  static async startWalletSync(walletId: string): Promise<void> {
    return this.api.startWalletSync(walletId)
  }

  static async stopWalletSync(): Promise<void> {
    return this.api.stopWalletSync()
  }

  static async resetWalletSync(network: Network): Promise<void> {
    await this.api.resetWalletSync(network)
  }

  static async hasSyncProgress(walletId: string): Promise<boolean> {
    return this.api.hasSyncProgress(walletId)
  }

  static async createWallet(seedphrase: string, network: Network, password: string): Promise<string> {
    return this.api.createWallet(seedphrase, network, password)
  }

  static async getAddresses(walletId: string) {
    return this.api.getAddresses(walletId)
  }

  static async addWalletAddress(walletId: string, isChange: boolean): Promise<string> {
    return this.api.addWalletAddress(walletId, isChange)
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

  static async setWalletLabel(walletId: string, label: string | null): Promise<void> {
    return this.api.setWalletLabel(walletId, label)
  }

  static async getTransactions(walletId: string): Promise<Transaction[]> {
    return this.api.getTransactions(walletId)
  }

  static async getUtxos(walletId: string): Promise<SelectableUtxo[]> {
    return this.api.getUtxos(walletId)
  }

  static async getTransactionByHash(hash: string, network: Network): Promise<WalletTxDto> {
    return this.api.getTransactionByHash(hash, network) as Promise<WalletTxDto>
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

  static async estimateFee(
    walletId: string,
    operation: TransferOperation,
    params: FeeParams,
  ): Promise<OperationFee> {
    return this.api.estimateFee(walletId, operation, params) as Promise<OperationFee>
  }

  static async deleteWallet(walletId: string): Promise<void> {
    return this.api.deleteWallet(walletId)
  }

  static async selectWallet(walletId: string): Promise<void> {
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

  static async saveTextFile(defaultFileName: string, content: string): Promise<boolean> {
    return this.api.saveTextFile(defaultFileName, content)
  }

  static async listLogFiles(): Promise<LogFileInfo[]> {
    return this.api.listLogFiles()
  }

  static async getLogFile(name: string): Promise<LogFileContent> {
    return this.api.getLogFile(name)
  }

  static async showLogFileInFolder(name: string): Promise<void> {
    return this.api.showLogFileInFolder(name)
  }

  static async getContacts(network?: Network): Promise<Contact[]> {
    return this.api.getContacts(network) as Promise<Contact[]>
  }

  static async addContact(label: string, address: string, network: Network): Promise<void> {
    return this.api.addContact(label, address, network)
  }

  static async deleteContact(id: number): Promise<void> {
    return this.api.deleteContact(id)
  }

  static async sendTransaction(walletId: string, toAddress: string, amountDuffs: bigint, password: string, source?: CoreSpendSource): Promise<SendResult> {
    return this.api.sendTransaction(walletId, toAddress, amountDuffs, password, source) as Promise<SendResult>
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

  static async sendPlatformTransfer(walletId: string, fromAddress: string, toAddress: string, amountCredits: bigint, password: string): Promise<PlatformSendResult> {
    return this.api.sendPlatformTransfer(walletId, fromAddress, toAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async topUpIdentityFromAddresses(walletId: string, identityId: string, fromAddress: string | null, amountCredits: bigint, password: string): Promise<PlatformSendResult> {
    return this.api.topUpIdentityFromAddresses(walletId, identityId, fromAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async withdrawPlatformCredits(walletId: string, fromAddress: string | null, toCoreAddress: string, amountCredits: bigint, password: string): Promise<PlatformSendResult> {
    return this.api.withdrawPlatformCredits(walletId, fromAddress, toCoreAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async sendIdentityCredits(walletId: string, identityId: string, toAddress: string, amountCredits: bigint, password: string): Promise<PlatformSendResult> {
    return this.api.sendIdentityCredits(walletId, identityId, toAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async transferIdentityCredits(walletId: string, fromIdentityId: string, toIdentityId: string, amountCredits: bigint, password: string): Promise<PlatformSendResult> {
    return this.api.transferIdentityCredits(walletId, fromIdentityId, toIdentityId, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async withdrawIdentityCredits(walletId: string, identityId: string, toCoreAddress: string, amountCredits: bigint, password: string): Promise<PlatformSendResult> {
    return this.api.withdrawIdentityCredits(walletId, identityId, toCoreAddress, amountCredits, password) as Promise<PlatformSendResult>
  }

  static async createIdentityFromAddresses(walletId: string, fromAddress: string | null, amountCredits: bigint, password: string): Promise<IdentityCreateResult> {
    return this.api.createIdentityFromAddresses(walletId, fromAddress, amountCredits, password) as Promise<IdentityCreateResult>
  }

  static async startAssetLockFunding(walletId: string, toPlatformAddress: string, amountDuffs: bigint, password: string, kind: AssetLockFundingKind = AssetLockFundingKind.Address, source?: CoreSpendSource): Promise<AssetLockFundingState> {
    return this.api.startAssetLockFunding(walletId, toPlatformAddress, amountDuffs, password, kind, source) as Promise<AssetLockFundingState>
  }

  static async getAssetLockFundingState(walletId: string): Promise<AssetLockFundingState> {
    return this.api.getAssetLockFundingState(walletId) as Promise<AssetLockFundingState>
  }

  static async resumeAssetLockFunding(walletId: string, password: string): Promise<AssetLockFundingState> {
    return this.api.resumeAssetLockFunding(walletId, password) as Promise<AssetLockFundingState>
  }

  static async dismissAssetLockFunding(walletId: string): Promise<AssetLockFundingState> {
    return this.api.dismissAssetLockFunding(walletId) as Promise<AssetLockFundingState>
  }

  static async shieldToPool(walletId: string, fromAddress: string, toAddress: string, amountCredits: bigint, password: string): Promise<ShieldResult> {
    return this.api.shieldToPool(walletId, fromAddress, toAddress, amountCredits, password) as Promise<ShieldResult>
  }

  static async startShieldedTransfer(walletId: string, recipient: string, amountCredits: bigint, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.api.startShieldedTransfer(walletId, recipient, amountCredits, password, noteIndexes) as Promise<ShieldedSpendState>
  }

  static async startShieldedUnshield(walletId: string, outputAddress: string, amountCredits: bigint, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.api.startShieldedUnshield(walletId, outputAddress, amountCredits, password, noteIndexes) as Promise<ShieldedSpendState>
  }

  static async startShieldedWithdrawal(walletId: string, coreAddress: string, amountCredits: bigint, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.api.startShieldedWithdrawal(walletId, coreAddress, amountCredits, password, noteIndexes) as Promise<ShieldedSpendState>
  }

  static async startShieldedIdentityCreate(walletId: string, denominationCredits: bigint, password: string): Promise<ShieldedSpendState> {
    return this.api.startShieldedIdentityCreate(walletId, denominationCredits, password) as Promise<ShieldedSpendState>
  }

  static async getShieldedSpendState(walletId: string): Promise<ShieldedSpendState> {
    return this.api.getShieldedSpendState(walletId) as Promise<ShieldedSpendState>
  }

  static async getShieldedAddress(walletId: string, password?: string): Promise<string | null> {
    return this.api.getShieldedAddress(walletId, password)
  }

  static async getShieldedAddresses(walletId: string, password?: string): Promise<string[] | null> {
    return this.api.getShieldedAddresses(walletId, password)
  }

  static async addShieldedAddress(walletId: string, password: string): Promise<string[]> {
    return this.api.addShieldedAddress(walletId, password)
  }
}
