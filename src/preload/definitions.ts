// The wallet has exactly two networks. Spelling it `string` on some signatures
// and the union on others let an unchecked value reach the IPC boundary.
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

export const apiDefinitions = (ipcRenderer) => ({
  createWallet: (seedphrase: string, network: Network, password: string) => ipcRenderer.invoke('createWallet', seedphrase, network, password),
  deleteWallet: (walletId: string) => ipcRenderer.invoke('deleteWallet', walletId),
  verifyWalletPassword: (walletId: string, password: string) => ipcRenderer.invoke('verifyWalletPassword', walletId, password),
  exportMnemonic: (walletId: string, password: string): Promise<string> => ipcRenderer.invoke('exportMnemonic', walletId, password),
  verifyWalletMnemonic: (walletId: string, mnemonic: string) => ipcRenderer.invoke('verifyWalletMnemonic', walletId, mnemonic),
  resetWalletPassword: (walletId: string, mnemonic: string, newPassword: string) => ipcRenderer.invoke('resetWalletPassword', walletId, mnemonic, newPassword),
  getAddresses: (walletId: string) => ipcRenderer.invoke('getAddresses', walletId),
  addWalletAddress: (walletId: string, isChange: boolean) => ipcRenderer.invoke('addWalletAddress', walletId, isChange),
  getReceiveAddress: (walletId: string) => ipcRenderer.invoke('getReceiveAddress', walletId),
  getStatus: () => ipcRenderer.invoke('getStatus'),
  selectWallet: (walletId: string) => ipcRenderer.invoke('selectWallet', walletId),
  getAllWallets: () => ipcRenderer.invoke('getAllWallets'),
  getTransactions: (walletId: string) => ipcRenderer.invoke('getTransactions', walletId),
  getTransactionByHash: (hash: string, network: Network) => ipcRenderer.invoke('getTransactionByHash', hash, network),
  getBalance: (address: string | string[], network: Network) => ipcRenderer.invoke('getBalance', address, network),
  getWalletBalance: (walletId: string) => ipcRenderer.invoke('getWalletBalance', walletId),
  getIdentities: (walletId: string) => ipcRenderer.invoke('getIdentities', walletId),
  getIdentityBalance: (identifier: string): Promise<bigint> => ipcRenderer.invoke('getIdentityBalance', identifier),
  getIdentityNonce: (identifier: string): Promise<bigint> => ipcRenderer.invoke('getIdentityNonce', identifier),
  getPlatformAddresses: (walletId: string) => ipcRenderer.invoke('getPlatformAddresses', walletId),
  addPlatformAddress: (walletId: string) => ipcRenderer.invoke('addPlatformAddress', walletId),
  setAddressLabel: (walletId: string, address: string, label: string) => ipcRenderer.invoke('setAddressLabel', walletId, address, label),
  setWalletLabel: (walletId: string, label: string | null) => ipcRenderer.invoke('setWalletLabel', walletId, label),
  sendTransaction: (walletId: string, recipients: CoreRecipient[], password: string, source?: CoreSpendSource) => ipcRenderer.invoke('sendTransaction', walletId, recipients, password, source),
  getTxLockStatus: (walletId: string, txid: string) => ipcRenderer.invoke('getTxLockStatus', walletId, txid),
  estimateFee: (walletId: string, operation: string, params: unknown) => ipcRenderer.invoke('estimateFee', walletId, operation, params),
  sendPlatformTransfer: (walletId: string, source: PlatformSpendSource | null, recipients: PlatformRecipient[], password: string) => ipcRenderer.invoke('sendPlatformTransfer', walletId, source, recipients, password),
  topUpIdentityFromAddresses: (walletId: string, identityId: string, source: PlatformSpendSource | null, amountCredits: bigint, password: string) => ipcRenderer.invoke('topUpIdentityFromAddresses', walletId, identityId, source, amountCredits, password),
  withdrawPlatformCredits: (walletId: string, source: PlatformSpendSource | null, toCoreAddress: string, amountCredits: bigint, password: string) => ipcRenderer.invoke('withdrawPlatformCredits', walletId, source, toCoreAddress, amountCredits, password),
  sendIdentityCredits: (walletId: string, identityId: string, toAddress: string, amountCredits: bigint, password: string) => ipcRenderer.invoke('sendIdentityCredits', walletId, identityId, toAddress, amountCredits, password),
  transferIdentityCredits: (walletId: string, fromIdentityId: string, toIdentityId: string, amountCredits: bigint, password: string) => ipcRenderer.invoke('transferIdentityCredits', walletId, fromIdentityId, toIdentityId, amountCredits, password),
  withdrawIdentityCredits: (walletId: string, identityId: string, toCoreAddress: string, amountCredits: bigint, password: string) => ipcRenderer.invoke('withdrawIdentityCredits', walletId, identityId, toCoreAddress, amountCredits, password),
  createIdentityFromAddresses: (walletId: string, source: PlatformSpendSource | null, amountCredits: bigint, password: string) => ipcRenderer.invoke('createIdentityFromAddresses', walletId, source, amountCredits, password),
  startAssetLockFunding: (walletId: string, toPlatformAddress: string, amountDuffs: bigint, password: string, kind?: string, source?: CoreSpendSource) => ipcRenderer.invoke('startAssetLockFunding', walletId, toPlatformAddress, amountDuffs, password, kind, source),
  getAssetLockFundingState: (walletId: string) => ipcRenderer.invoke('getAssetLockFundingState', walletId),
  resumeAssetLockFunding: (walletId: string, password: string) => ipcRenderer.invoke('resumeAssetLockFunding', walletId, password),
  dismissAssetLockFunding: (walletId: string) => ipcRenderer.invoke('dismissAssetLockFunding', walletId),
  shieldToPool: (walletId: string, fromAddress: string, toAddress: string, amountCredits: bigint, password: string) => ipcRenderer.invoke('shieldToPool', walletId, fromAddress, toAddress, amountCredits, password),
  // preferencess
  getPreferences: () => ipcRenderer.invoke('getPreferences'),
  setLanguage: (language: string) => ipcRenderer.invoke('setLanguage', language),
  setLogLevel: (level: string) => ipcRenderer.invoke('setLogLevel', level),
  setFiatCurrency: (currency: string) => ipcRenderer.invoke('setFiatCurrency', currency),
  setConnectionType: (connectionType: 'p2p' | 'rpc') => ipcRenderer.invoke('setConnectionType', connectionType),
  setPlatformFeeMultiplier: (platformFeeMultiplier: number) => ipcRenderer.invoke('setPlatformFeeMultiplier', platformFeeMultiplier),
  setCoreFeeMultiplier: (coreFeeMultiplier: number) => ipcRenderer.invoke('setCoreFeeMultiplier', coreFeeMultiplier),
  resetPreferences: () => ipcRenderer.invoke('resetPreferences'),

  startWalletSync: (walletId: string) => ipcRenderer.invoke('startWalletSync', walletId),
  stopWalletSync: () => ipcRenderer.invoke('stopWalletSync'),
  resetWalletSync: (network: Network) => ipcRenderer.invoke('resetWalletSync', network),
  getUtxos: (walletId: string) => ipcRenderer.invoke('getUtxos', walletId),
  hasSyncProgress: (walletId: string) => ipcRenderer.invoke('hasSyncProgress', walletId),
  broadcastTransaction: (txHex: string) => ipcRenderer.invoke('broadcastTransaction', txHex),

  getExchangeRates: () => ipcRenderer.invoke('getExchangeRates'),

  saveTextFile: (defaultFileName: string, content: string) => ipcRenderer.invoke('saveTextFile', defaultFileName, content),
  listLogFiles: () => ipcRenderer.invoke('listLogFiles'),
  getLogFile: (name: string) => ipcRenderer.invoke('getLogFile', name),
  showLogFileInFolder: (name: string) => ipcRenderer.invoke('showLogFileInFolder', name),

  getContacts: (network?: Network) => ipcRenderer.invoke('getContacts', network),
  addContact: (label: string, address: string, network: Network) => ipcRenderer.invoke('addContact', label, address, network),
  deleteContact: (id: number) => ipcRenderer.invoke('deleteContact', id),

  getShieldedStatus: () => ipcRenderer.invoke('getShieldedStatus'),
  getShieldedPoolInfo: (network: Network) => ipcRenderer.invoke('getShieldedPoolInfo', network),
  getShieldedNotesInfo: (walletId: string) => ipcRenderer.invoke('getShieldedNotesInfo', walletId),
  startShieldedSync: (walletId: string, password: string) => ipcRenderer.invoke('startShieldedSync', walletId, password),
  getShieldedSyncState: (walletId: string) => ipcRenderer.invoke('getShieldedSyncState', walletId),
  refreshShieldedSpentNotes: (walletId: string) => ipcRenderer.invoke('refreshShieldedSpentNotes', walletId),
  startShieldedTransfer: (walletId: string, recipients: ShieldedRecipient[], password: string, source?: ShieldedSpendSource) => ipcRenderer.invoke('startShieldedTransfer', walletId, recipients, password, source),
  startShieldedUnshield: (walletId: string, outputAddress: string, amountCredits: bigint, password: string, source?: ShieldedSpendSource) => ipcRenderer.invoke('startShieldedUnshield', walletId, outputAddress, amountCredits, password, source),
  startShieldedWithdrawal: (walletId: string, coreAddress: string, amountCredits: bigint, password: string, source?: ShieldedSpendSource) => ipcRenderer.invoke('startShieldedWithdrawal', walletId, coreAddress, amountCredits, password, source),
  startShieldedIdentityCreate: (walletId: string, denominationCredits: bigint, password: string) => ipcRenderer.invoke('startShieldedIdentityCreate', walletId, denominationCredits, password),
  getShieldedSpendState: (walletId: string) => ipcRenderer.invoke('getShieldedSpendState', walletId),
  getShieldedAddress: (walletId: string, password?: string) => ipcRenderer.invoke('getShieldedAddress', walletId, password),
  getShieldedAddresses: (walletId: string, password?: string) => ipcRenderer.invoke('getShieldedAddresses', walletId, password),
  addShieldedAddress: (walletId: string, password: string) => ipcRenderer.invoke('addShieldedAddress', walletId, password),
})
