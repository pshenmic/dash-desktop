export class API {
  private static get api() {
    return window.electronAPI
  }

  static async createWallet(seedphrase: string, network: string, password: string) {
    return this.api.createWallet(seedphrase, network, password)
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

  static async getTransactions(walletId: string) {
    return this.api.getTransactions(walletId)
  }

  static async getIdentities(walletId: string) {
    return this.api.getIdentities(walletId)
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
}
