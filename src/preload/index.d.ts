import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: {
      createWallet: (seedphrase: string, network: string, password: string) => Promise<unknown>
      verifyWalletPassword: (walletId: string, password: string) => Promise<boolean>
      exportMnemonic: (walletId: string, password: string) => Promise<string>
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
      getPlatformAddresses: (walletId: string) => Promise<unknown>
      deleteWallet: (walletId: string) => Promise<unknown>
      selectWallet: (walletId: string) => Promise<unknown>
      getWalletBalance: (walletId: string) => Promise<unknown>
      setAddressLabel: (walletId: string, address: string, label: string) => Promise<unknown>
      setWalletLabel: (walletId: string, label: string | null) => Promise<{ success: boolean; errorMessage: string | null }>
      sendTransaction: (walletId: string, toAddress: string, amountDuffs: string, password: string) => Promise<unknown>
      sendPlatformTransfer: (walletId: string, fromAddress: string, toAddress: string, amountCredits: string, password: string) => Promise<unknown>
      topUpIdentityFromAddresses: (walletId: string, identityId: string, fromAddress: string | null, amountCredits: string, password: string) => Promise<unknown>
      withdrawPlatformCredits: (walletId: string, fromAddress: string | null, toCoreAddress: string, amountCredits: string, password: string) => Promise<unknown>
      sendIdentityCredits: (walletId: string, identityId: string, toAddress: string, amountCredits: string, password: string) => Promise<unknown>
      createIdentityFromAddresses: (walletId: string, fromAddress: string | null, amountCredits: string, password: string) => Promise<unknown>
      shieldToPool: (walletId: string, fromAddress: string, amountCredits: string, password: string) => Promise<{ stHash: string; amountCredits: string; fromAddress: string }>
      broadcastTransaction: (txHex: string) => Promise<unknown>
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
      getExchangeRates: () => Promise<unknown>
      saveTextFile: (defaultFileName: string, content: string) => Promise<{ success: boolean; errorMessage: string | null }>
      getContacts: (network?: 'mainnet' | 'testnet') => Promise<unknown>
      addContact: (label: string, address: string, network: 'mainnet' | 'testnet') => Promise<unknown>
      deleteContact: (id: number) => Promise<unknown>
      getShieldedStatus: () => Promise<{ warmup: 'idle' | 'preparing' | 'ready' | 'error'; ready: boolean; error: string | null }>
      getShieldedPoolInfo: (network: 'mainnet' | 'testnet') => Promise<{ poolState: string | null; notesCount: string | null }>
      startShieldedSync: (walletId: string, password: string) => Promise<{ phase: 'idle' | 'syncing' | 'recovering' | 'done' | 'error'; fetched: number; total: number; balance: string | null; notes: { index: number; amount: string }[]; error: string | null; syncedAt: number | null }>
      getShieldedSyncState: (walletId: string) => Promise<{ phase: 'idle' | 'syncing' | 'recovering' | 'done' | 'error'; fetched: number; total: number; balance: string | null; notes: { index: number; amount: string }[]; error: string | null; syncedAt: number | null }>
      startShieldedTransfer: (walletId: string, recipient: string, amountCredits: string, password: string) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
      startShieldedUnshield: (walletId: string, outputAddress: string, amountCredits: string, password: string) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
      startShieldedWithdrawal: (walletId: string, coreAddress: string, amountCredits: string, password: string) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
      getShieldedSpendState: (walletId: string) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
    }
    darkMode: {
      get: () => Promise<boolean>
      system: () => Promise<void>
      onChange: (callback: (isDark: boolean) => void) => void
    }
  }
}
