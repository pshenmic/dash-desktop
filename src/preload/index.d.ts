import { ElectronAPI } from '@electron-toolkit/preload'

// Mirrors definitions.ts, which declares the same alias: the bundles do not
// share types, so each spells the two networks out for itself.
type Network = 'mainnet' | 'testnet'

// Mirrors src/main/src/types/CoinSelection, which the bundles do not share: an
// address narrows the automatic selection, a picked outpoint list is spent whole.
type CoreSpendSource =
  | { kind: 'address'; address: string }
  | { kind: 'outpoints'; outpoints: { txid: string; vout: number }[] }

// Mirrors the CoreRecipient in src/main/src/types/CoreTransaction: one
// transaction can pay many addresses, each its own amount.
type CoreRecipient = { address: string; amountDuffs: bigint }

// Mirrors src/main/src/types/ShieldedNoteSelection: an address narrows the
// automatic note selection, a picked note list is spent whole.
type ShieldedSpendSource =
  | { kind: 'address'; noteIndexes: number[] }
  | { kind: 'notes'; noteIndexes: number[] }

// Mirrors the ShieldedRecipient in the same file: one bundle pays several
// Orchard addresses, each its own amount.
type ShieldedRecipient = { address: string; amountCredits: bigint }

// Mirrors src/main/src/types/PlatformTransfer: one address to draw from, or
// every address it may draw on, how much of each, and which one is charged.
type PlatformPickedInput = { address: string; credits: bigint }
type PlatformFeeStep =
  | { kind: 'deductFromInput'; address: string }
  | { kind: 'reduceOutput'; index: number }
// Mirrors the Recipient in src/main/platform/types/messages: one transition can
// pay many addresses, each its own amount.
type PlatformRecipient = { address: string; amountCredits: bigint }
type PlatformSpendSource =
  | { kind: 'address'; address: string }
  | { kind: 'inputs'; inputs: PlatformPickedInput[]; feeStrategy: PlatformFeeStep[] }

// Every coin a send can draw on: what getUtxos lists and what an outpoints
// source picks from.
interface SelectableUtxoDTO {
  txid: string
  vout: number
  satoshis: bigint
  address: string
  height: number
}

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
      addWalletAddress: (walletId: string, isChange: boolean) => Promise<string>
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
      sendTransaction: (walletId: string, recipients: CoreRecipient[], password: string, source?: CoreSpendSource) => Promise<unknown>
      getTxLockStatus: (walletId: string, txid: string) => Promise<unknown>
      estimateFee: (walletId: string, operation: string, params: unknown) => Promise<{ feeCredits: bigint | null; feeDuffs: bigint | null; maxDuffs: bigint | null; maxPerTx: bigint | null; noteLimit: number | null }>
      sendPlatformTransfer: (walletId: string, source: PlatformSpendSource | null, recipients: PlatformRecipient[], password: string) => Promise<unknown>
      topUpIdentityFromAddresses: (walletId: string, identityId: string, source: PlatformSpendSource | null, amountCredits: bigint, password: string) => Promise<unknown>
      withdrawPlatformCredits: (walletId: string, source: PlatformSpendSource | null, toCoreAddress: string, amountCredits: bigint, password: string) => Promise<unknown>
      sendIdentityCredits: (walletId: string, identityId: string, toAddress: string, amountCredits: bigint, password: string) => Promise<unknown>
      transferIdentityCredits: (walletId: string, fromIdentityId: string, toIdentityId: string, amountCredits: bigint, password: string) => Promise<unknown>
      withdrawIdentityCredits: (walletId: string, identityId: string, toCoreAddress: string, amountCredits: bigint, password: string) => Promise<unknown>
      createIdentityFromAddresses: (walletId: string, source: PlatformSpendSource | null, amountCredits: bigint, password: string) => Promise<unknown>
      startAssetLockFunding: (walletId: string, toPlatformAddress: string, amountDuffs: bigint, password: string, kind?: string, source?: CoreSpendSource) => Promise<unknown>
      getAssetLockFundingState: (walletId: string) => Promise<unknown>
      resumeAssetLockFunding: (walletId: string, password: string) => Promise<unknown>
      dismissAssetLockFunding: (walletId: string) => Promise<unknown>
      shieldToPool: (walletId: string, fromAddress: string, toAddress: string, amountCredits: bigint, password: string) => Promise<{ stHash: string; amountCredits: bigint; fromAddress: string }>
      broadcastTransaction: (txHex: string) => Promise<unknown>
      getPreferences: () => Promise<unknown>
      setLanguage: (language: string) => Promise<void>
      setFiatCurrency: (currency: string) => Promise<void>
      setConnectionType: (connectionType: 'p2p' | 'rpc') => Promise<void>
      setPlatformFeeMultiplier: (platformFeeMultiplier: number) => Promise<void>
      setCoreFeeMultiplier: (coreFeeMultiplier: number) => Promise<void>
      getConnectedPeers: () => Promise<unknown>
      setPeerMode: (mode: 'dynamic' | 'static') => Promise<void>
      pushStaticPeer: (network: Network, peer: string) => Promise<unknown>
      removeStaticPeer: (network: Network, peer: string) => Promise<unknown>
      getStaticPeers: (network: Network) => Promise<unknown>
      setBannedPeers: (network: Network, peers: string[]) => Promise<void>
      getBannedPeers: (network: Network) => Promise<unknown>
      setDnsSeeds: (network: Network, seeds: string[]) => Promise<void>
      getDnsSeeds: (network: Network) => Promise<unknown>
      setDynamicPeers: (network: Network, peers: string[]) => Promise<void>
      getDynamicPeers: (network: Network) => Promise<unknown>
      resetPreferences: () => Promise<void>
      startWalletSync: (walletId: string) => Promise<void>
      stopWalletSync: () => Promise<void>
      resetWalletSync: (network: Network) => Promise<void>
      getUtxos: (walletId: string) => Promise<SelectableUtxoDTO[]>
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
      refreshShieldedSpentNotes: (walletId: string) => Promise<{ phase: 'idle' | 'syncing' | 'recovering' | 'done' | 'error'; fetched: number; total: number; balance: bigint | null; notes: { index: number; amount: bigint; spent: boolean }[]; error: string | null; syncedAt: number | null }>
      startShieldedTransfer: (walletId: string, recipients: ShieldedRecipient[], password: string, source?: ShieldedSpendSource) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
      startShieldedUnshield: (walletId: string, outputAddress: string, amountCredits: bigint, password: string, source?: ShieldedSpendSource) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
      startShieldedWithdrawal: (walletId: string, coreAddress: string, amountCredits: bigint, password: string, source?: ShieldedSpendSource) => Promise<{ phase: 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'; fetched: number; total: number; stHash: string | null; error: string | null }>
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
