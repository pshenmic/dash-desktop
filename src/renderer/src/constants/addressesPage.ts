export interface AddressesPage {
  title: string
  filter: string
  tabs: {
    receiving: string
    change: string
    platform: string
    shielded: string
    coinJoin: string
  }
  labelPrefix: string
  usedBadge: string
  shieldedSharedBalance: string
}

export const addressesPage: AddressesPage = {
  title: 'Addresses',
  filter: 'Filter',
  tabs: {
    receiving: 'Receiving',
    change: 'Change',
    platform: 'Platform',
    shielded: 'Shielded',
    coinJoin: 'CoinJoin',
  },
  labelPrefix: 'Label',
  usedBadge: 'Used',
  shieldedSharedBalance: 'All shielded addresses share one private balance.',
}

export const addressFormCopy = {
  platformPrompt: 'Enter your wallet password to show Platform addresses.',
  shieldedPrompt: 'Enter your wallet password to show your shielded addresses.',
  showAddresses: 'Show addresses',
  loading: 'Loading…',
  adding: 'Adding…',
  loadFailed: "Couldn't load addresses. Try again.",
  addFailed: "Couldn't add the address. Try again.",
}
