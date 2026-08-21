interface TransactionType {
  title: string
  detailLabel: string
}

interface TransactionsPage {
  balance: {
    balance: string
    usdPrice: string
    comparedToYesterday: string
  }
  transactions: {
    title: string
    filter: string
    types: {
      receive: TransactionType
      send: TransactionType
      documentsBatch: TransactionType
    }
    filters: {
      search: {
        label: string
        placeholder: string
      }
      direction: {
        label: string
        all: string
        received: string
        sent: string
      }
      type: {
        label: string
        all: string
        transfer: string
        assetLock: string
      }
      totals: {
        received: string
        sent: string
      }
      noMatch: string
    }
  }
  detail: {
    backButton: string
    titlePrefix: string
    transactionId: string
    details: string
    size: string
    bytes: string
    fields: {
      date: string
      height: string
      amount: string
      confirmations: string
      lockTime: string
    }
    inputs: string
    outputs: string
    receivingBadge: string
    changeBadge: string
    qrTitle: string
  }
}

export const transactionsPage: TransactionsPage = {
  balance: {
    balance: 'Balance',
    usdPrice: 'USD price',
    comparedToYesterday: 'Compared to yesterday'
  },
  transactions: {
    title: 'Transactions',
    filter: 'Filter',
    types: {
      receive: {
        title: 'Receive',
        detailLabel: 'From:',
      },
      send: {
        title: 'Send',
        detailLabel: 'To:',
      },
      documentsBatch: {
        title: 'Documents Batch',
        detailLabel: 'Hash:',
      }
    },
    filters: {
      search: {
        label: 'Search transactions',
        placeholder: 'txid or address',
      },
      direction: {
        label: 'Direction',
        all: 'All',
        received: 'Received',
        sent: 'Sent',
      },
      type: {
        label: 'Type',
        all: 'All',
        transfer: 'Transfers',
        assetLock: 'Asset locks',
      },
      totals: {
        received: 'Received',
        sent: 'Sent',
      },
      noMatch: 'No transactions match the selected filter'
    }
  },
  detail: {
    backButton: 'Back',
    titlePrefix: 'Transaction:',
    transactionId: 'Transaction ID',
    details: 'Details',
    size: 'Size',
    bytes: 'bytes',
    fields: {
      date: 'Date',
      height: 'Height',
      amount: 'Amount',
      confirmations: 'Confirmations',
      lockTime: 'LockTime',
    },
    inputs: 'Inputs',
    outputs: 'Outputs',
    receivingBadge: 'Receiving',
    changeBadge: 'Change',
    qrTitle: 'Address',
  }
}
