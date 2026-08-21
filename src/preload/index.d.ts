import { ElectronAPI } from '@electron-toolkit/preload'

// Mirrors definitions.ts, which declares the same alias: the bundles do not
// share types, so each spells the two networks out for itself.
type Network = 'mainnet' | 'testnet'

// Hand-maintained alongside definitions.ts, and deliberately a second
// declaration of src/main/src/types/Transaction: the three bundles do not share
// types. Amounts stay bigint — structured clone carries them as themselves.
interface TransactionInputDTO {
  value: string
  n: number
  addr: string
  prevTxId: string
  prevVout: number
  sequence: number
}

interface TransactionOutputDTO {
  value: string
  n: number
  address: string
  spentTxId: string
  spentIndex: number
  spentHeight: number
}

interface TransactionDTO {
  address: string
  direction: number
  inAmount: bigint
  outAmount: bigint
  transferAmount: bigint
  usdAmount: string
  date: Date
  size: number
  blockHeight: number
  status: 'Pending' | 'Locked'
  walletId: string
  confirmations: number
  txid: string
  vin: TransactionInputDTO[]
  vout: TransactionOutputDTO[]
  instantLocked: boolean
  chainlocked: boolean
  isLocal: boolean | null
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: {
      createWallet: (seedphrase: string, network: Network, password: string) => Promise<string>
      verifyWalletPassword: (walletId: string, password: string) => Promise<boolean>
      exportMnemonic: (walletId: string, password: string) => Promise<string>
      verifyWalletMnemonic: (walletId: string, mnemonic: string) => Promise<boolean>
      resetWalletPassword: (walletId: string, mnemonic: string, newPassword: string) => Promise<boolean>
      getAddresses: (walletId: string) => Promise<unknown>
      addWalletAddress: (walletId: string, password: string, isChange: boolean) => Promise<string>
      getReceiveAddress: (walletId: string) => Promise<string | null>
      getStatus: () => Promise<unknown>
      getAllWallets: () => Promise<unknown>
      getTransactions: (walletId: string) => Promise<TransactionDTO[]>
      getTransactionByHash: (hash: string, network: Network) => Promise<TransactionDTO>
      getBalance: (address: string | string[], network: Network) => Promise<unknown>
      getIdentities: (walletId: string) => Promise<unknown>
      getIdentityBalance: (identifier: string) => Promise<bigint>
      getIdentityNonce: (identifier: string) => Promise<bigint>
      getPlatformAddresses: (walletId: string) => Promise<unknown>
      addPlatformAddress: (walletId: string) => Promise<unknown>
      deleteWallet: (walletId: string) => Promise<void>
      selectWallet: (walletId: string) => Promise<void>
      getWalletBalance: (walletId: string) => Promise<unknown>
      setAddressLabel: (walletId: string, address: string, label: string) => Promise<void>
      setWalletLabel: (walletId: string, label: string | null) => Promise<void>
      sendTransaction: (walletId: string, toAddress: string, amountDuffs: bigint, password: string, fromAddress?: string) => Promise<unknown>
      getTxLockStatus: (walletId: string, txid: string) => Promise<unknown>
      estimateTransitionFee: (network: Network, query: unknown) => Promise<{ minFeeCredits: bigint; storageFeeCredits: bigint; totalFeeCredits: bigint; newAddresses: string[] }>
      sendPlatformTransfer: (walletId: string, fromAddress: string, toAddress: string, amountCredits: bigint, password: string) => Promise<unknown>
      topUpIdentityFromAddresses: (walletId: string, identityId: string, fromAddress: string | null, amountCredits: bigint, password: string) => Promise<unknown>
      withdrawPlatformCredits: (walletId: string, fromAddress: string | null, toCoreAddress: string, amountCredits: bigint, password: string) => Promise<unknown>
      sendIdentityCredits: (walletId: string, identityId: string, toAddress: string, amountCredits: bigint, password: string) => Promise<unknown>
      transferIdentityCredits: (walletId: string, fromIdentityId: string, toIdentityId: string, amountCredits: bigint, password: string) => Promise<unknown>
      withdrawIdentityCredits: (walletId: string, identityId: string, toCoreAddress: string, amountCredits: bigint, password: string) => Promise<unknown>
      createIdentityFromAddresses: (walletId: string, fromAddress: string | null, amountCredits: bigint, password: string) => Promise<unknown>
      startAssetLockFunding: (walletId: string, toPlatformAddress: string, amountDuffs: bigint, password: string, kind?: string) => Promise<unknown>
      getAssetLockFundingState: (walletId: string) => Promise<unknown>
      resumeAssetLockFunding: (walletId: string, password: string) => Promise<unknown>
      dismissAssetLockFunding: (walletId: string) => Promise<unknown>
      shieldToPool: (walletId: string, fromAddress: string, toAddress: string, amountCredits: bigint, password: string) => Promise<{ stHash: string; amountCredits: bigint; fromAddress: string }>
      broadcastTransaction: (txHex: string) => Promise<unknown>
      getPreferences: () => Promise<unknown>
      setLanguage: (language: string) => Promise<void>
      setFiatCurrency: (currency: string) => Promise<void>
      setConnectionType: (connectionType: 'p2p' | 'rpc') => Promise<void>
      resetPreferences: () => Promise<void>
      startWalletSync: (walletId: string) => Promise<void>
      stopWalletSync: () => Promise<void>
      resetWalletSync: (network: Network) => Promise<void>
      getUtxos: () => Promise<unknown>
      hasSyncProgress: (walletId: string) => Promise<boolean>
      getExchangeRates: () => Promise<unknown>
      saveTextFile: (defaultFileName: string, content: string) => Promise<boolean>
      listLogFiles: () => Promise<{ name: string; size: number; modifiedAt: number; rotated: boolean }[]>
      getLogFile: (name: string) => Promise<{ name: string; content: string; size: number; modifiedAt: number; rotated: boolean }>
      showLogFileInFolder: (name: string) => Promise<void>
      getContacts: (network?: Network) => Promise<unknown>
      addContact: (label: string, address: string, network: Network) => Promise<void>
      deleteContact: (id: number) => Promise<void>
      getShieldedStatus: () => Promise<{ prover: 'idle' | 'preparing' | 'ready' | 'error'; ready: boolean; error: string | null }>
      getShieldedPoolInfo: (network: Network) => Promise<{ poolState: bigint | null; notesCount: bigint | null }>
      getShieldedNotesInfo: (walletId: string) => Promise<{ undecodedCount: number }>
      startShieldedSync: (walletId: string, password: string) => Promise<{ phase: 'idle' | 'syncing' | 'recovering' | 'done' | 'error'; fetched: number; total: number; balance: bigint | null; notes: { index: number; amount: bigint; spent: boolean }[]; error: string | null; syncedAt: number | null }>
      getShieldedSyncState: (walletId: string) => Promise<{ phase: 'idle' | 'syncing' | 'recovering' | 'done' | 'error'; fetched: number; total: number; balance: bigint | null; notes: { index: number; amount: bigint; spent: boolean }[]; error: string | null; syncedAt: number | null }>
      startShieldedTransfer: (walletId: string, recipient: string, amountCredits: bigint, password: string, noteIndexes?: number[]) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
      startShieldedUnshield: (walletId: string, outputAddress: string, amountCredits: bigint, password: string, noteIndexes?: number[]) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
      startShieldedWithdrawal: (walletId: string, coreAddress: string, amountCredits: bigint, password: string, noteIndexes?: number[]) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
      startShieldedIdentityCreate: (walletId: string, denominationCredits: bigint, password: string) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; identityId: string | null; error: string | null }>
      getShieldedSpendState: (walletId: string) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; identityId: string | null; error: string | null }>
      getShieldedAddress: (walletId: string, password?: string) => Promise<string | null>
      getShieldedAddresses: (walletId: string, password?: string) => Promise<string[] | null>
      addShieldedAddress: (walletId: string, password: string) => Promise<string[]>
    }
    darkMode: {
      get: () => Promise<boolean>
      system: () => Promise<void>
      onChange: (callback: (isDark: boolean) => void) => void
    }
  }
}
