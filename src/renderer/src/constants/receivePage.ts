
export interface ReceivePageType {
  header: {
    title: string
    balance: string
  },
  tabs: {
    dash: string
    shielded: string
  },
  receiveAddressCard: {
    adressText: string
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
    dash: 'Dash',
    shielded: 'Shielded',
  },
  receiveAddressCard: {
    adressText: 'Dash Address',
    amount: 'Amount',
    placeholder: 'Enter Requesting Amount',
    description: 'You can send any amount convenient for you. We are ready to accept a transfer at any time!',
  },
}
