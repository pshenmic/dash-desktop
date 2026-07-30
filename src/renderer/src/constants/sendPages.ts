export interface TransferPageType {
  header: {
    title: string
    description: string
    balance: string
  }
  recipient: {
    label: string
    placeholder: string
    addressBook: string
    addressManagement: string
    names: string
    noResults: string
  }
  amountSummary: {
    fees: string
    totalAmount: string
    button: string
  }
}

export const WITHDRAWAL_SUCCESS_NOTE = 'Withdrawals are processed by Core with a delay — the Dash payout usually takes several minutes to appear in your transaction list.'

export const sendPageData: TransferPageType = {
  header: {
    title: 'Send',
    description: 'Send Dash from this wallet. Enter a recipient address and amount, then carefully check the details before proceeding.',
    balance: 'Balance',
  },
  recipient: {
    label: 'Recipient',
    placeholder: 'Enter address or search name',
    addressBook: 'Address Book',
    addressManagement: 'Address Management',
    names: 'Names',
    noResults: 'No addresses found',
  },
  amountSummary: {
    fees: 'Fees:',
    totalAmount: 'Total Amount:',
    button: 'Next',
  }
}
