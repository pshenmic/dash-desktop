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
    }
    darkMode: {
      get: () => Promise<boolean>
      system: () => Promise<void>
      onChange: (callback: (isDark: boolean) => void) => void
    }
  }
}
