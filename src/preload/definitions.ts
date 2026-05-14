export const apiDefinitions = (ipcRenderer) => ({
  createWallet: (seedphrase: string, network: string, password: string) => ipcRenderer.invoke('createWallet', seedphrase, network, password),
  deleteWallet: (walletId: string) => ipcRenderer.invoke('deleteWallet', walletId),
  verifyWalletPassword: (walletId: string, password: string) => ipcRenderer.invoke('verifyWalletPassword', password, walletId),
  getAddresses: (walletId: string) => ipcRenderer.invoke('getAddresses', walletId),
  getStatus: () => ipcRenderer.invoke('getStatus'),
  selectWallet: (walletId: string) => ipcRenderer.invoke('selectWallet', walletId),
  getAllWallets: () => ipcRenderer.invoke('getAllWallets'),
  getTransactions: (walletId: string) => ipcRenderer.invoke('getTransactions', walletId),
  getTransactionByHash: (hash: string, network: string) => ipcRenderer.invoke('getTransactionByHash', hash, network),
  getBlockByHash: (hash: string, network: string) => ipcRenderer.invoke('getBlockByHash', hash, network),
  getBalance: (address: string | string[], network: string) => ipcRenderer.invoke('getBalance', address, network),
  getWalletBalance: (walletId: string) => ipcRenderer.invoke('getWalletBalance', walletId),
  getIdentities: (walletId: string) => ipcRenderer.invoke('getIdentities', walletId),
  getIdentityBalance: (identifier: string): Promise<bigint> => ipcRenderer.invoke('getIdentityBalance', identifier),
  getIdentityNonce: (identifier: string): Promise<bigint> => ipcRenderer.invoke('getIdentityNonce', identifier),
  setAddressLabel: (walletId: string, address: string, label: string) => ipcRenderer.invoke('setAddressLabel', walletId, address, label),
  // preferencess
  getPreferences: () => ipcRenderer.invoke('getPreferences'),
  setLanguage: (language: string) => ipcRenderer.invoke('setLanguage', language),
  setFiatCurrency: (currency: string) => ipcRenderer.invoke('setFiatCurrency', currency),
  resetPreferences: () => ipcRenderer.invoke('resetPreferences')
})
