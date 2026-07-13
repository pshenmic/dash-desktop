export interface AddressesPage {
  title: string
  description: string
  filter: string
  tabs: {
    receiving: string
    change: string
    platform: string
    shielded: string
    coinJoin: string
  }
  labelPrefix: string
}

export const addressesPage: AddressesPage = {
  title: 'Addresses',
  description: 'This is a list of all your **Dash**  addresses. You can use these address to send or receive funds to your wallet. It is **highly suggested to not reuse the same address** for full privacy. You can also create a new address.',
  filter: 'Filter',
  tabs: {
    receiving: 'Receiving',
    change: 'Change',
    platform: 'Platform',
    shielded: 'Shielded',
    coinJoin: 'CoinJoin',
  },
  labelPrefix: 'Label',
}
