import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: {
      createWallet: (seedphrase: string, network: string, password: string) => Promise<unknown>
      verifyWalletPassword: (walletId: string, password: string) => Promise<boolean>
      getAddresses: (walletId: string) => Promise<unknown>
      getReceiveAddress: (walletId: string) => Promise<string | null>
      getStatus: () => Promise<unknown>
      getAllWallets: () => Promise<unknown>
      getTransactions: (walletId: string) => Promise<unknown>
      getTransactionByHash: (hash: string, network: string) => Promise<unknown>
      getBlockByHash: (hash: string, network: string) => Promise<unknown>
      getBalance: (address: string | string[], network: string) => Promise<unknown>
      getIdentities: (walletId: string) => Promise<unknown>
      getIdentityBalance: (identifier: string) => Promise<bigint>
      getIdentityNonce: (identifier: string) => Promise<bigint>
      deleteWallet: (walletId: string) => Promise<unknown>
      selectWallet: (walletId: string) => Promise<unknown>
      getWalletBalance: (walletId: string) => Promise<unknown>
      setAddressLabel: (walletId: string, address: string, label: string) => Promise<unknown>
      getPreferences: () => Promise<unknown>
      setLanguage: (language: string) => Promise<unknown>
      setFiatCurrency: (currency: string) => Promise<unknown>
      setConnectionType: (connectionType: 'p2p' | 'rpc') => Promise<unknown>
      resetPreferences: () => Promise<unknown>
      startWalletSync: (walletId: string) => Promise<unknown>
      stopWalletSync: () => Promise<void>
      resetWalletSync: (network: 'mainnet' | 'testnet') => Promise<unknown>
      getUtxos: () => Promise<unknown>
      hasSyncProgress: (walletId: string) => Promise<boolean>
    }
    darkMode: {
      get: () => Promise<boolean>
      system: () => Promise<void>
      onChange: (callback: (isDark: boolean) => void) => void
    }
  }
}
