
export interface ReceivePageType {
  header: {
    title: string
    balance: string
  },
  tabs: {
    core: string
    shielded: string
    platform: string
  },
  receiveAddressCard: {
    addressText: string
    amount: string
    placeholder: string
    description: string
  }
}

export const receivePage = {
  header: {
    title: 'Receive',
    balance: 'Balance',
  },
  tabs: {
    core: 'Core',
    shielded: 'Shielded',
    platform: 'Platform',
  },
  receiveAddressCard: {
    addressText: 'Dash Address',
    amount: 'Amount',
    placeholder: 'Enter Requesting Amount',
    description: 'You can send any amount convenient for you. We are ready to accept a transfer at any time!',
  },
}
