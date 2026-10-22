const SEND_BACK_LABEL = 'Back to Send'

export const DASHPAY_BACK_LABEL = 'Back to DashPay'

const CONTACTS_BACK_LABEL = 'Back to contacts'

export const PAGE_HEADERS = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Balances, recent activity and analytics for this wallet.',
  },
  transactions: {
    title: 'Transactions',
    subtitle: 'Core and Platform activity for this wallet.',
  },
  transactionDetail: {
    back: 'Back to transactions',
  },
  receive: {
    title: 'Receive',
    subtitle: 'Share an address or QR code to receive Dash.',
  },
  send: {
    title: 'Send',
    subtitle: {
      lead: 'Move funds between your ',
      emphasis: 'Dash Core, Platform addresses, identities and the shielded pool.',
      tail: ' Pick where the funds come from and where they go.',
    },
  },
  recipients: {
    title: 'Recipients',
    subtitle: {
      emphasis: 'Choose amounts and addresses',
      tail: ' that will receive transferred funds.',
    },
    back: SEND_BACK_LABEL,
  },
  coinControl: {
    title: 'Coin Control',
    subtitle: {
      lead: 'Flexible selector of ',
      emphasis: 'which funds this transfer may spend',
      tail: '. Leave the option on automatic if you don’t want to select specific addresses.',
    },
    back: SEND_BACK_LABEL,
  },
  sendPreview: {
    title: 'Transaction details',
    back: SEND_BACK_LABEL,
  },
  addressBook: {
    title: 'Address book',
    subtitle: 'Addresses and identities you send to.',
  },
  walletAddresses: {
    title: 'Wallet addresses',
    subtitle: 'Your Core, Platform and shielded addresses.',
    back: 'Back to address book',
  },
  identities: {
    title: 'Identities',
    subtitle: 'Manage your Dash Platform identities and their credit balances.',
  },
  identityRegistration: {
    title: 'Identity registration',
    subtitle: 'Fund a new identity from Core, Platform or Shielded.',
    back: 'Back to identities',
  },
  dashpay: {
    title: 'DashPay',
    subtitle: 'Usernames, contacts and payments for one identity.',
  },
  dashpayContact: {
    back: CONTACTS_BACK_LABEL,
  },
  registerUsername: {
    title: 'Register username',
    subtitle: 'Claim a .dash name for this identity.',
    back: DASHPAY_BACK_LABEL,
  },
  addContact: {
    title: 'Add contact',
    subtitle: 'Find someone by username or identity ID.',
    back: CONTACTS_BACK_LABEL,
  },
  addIdentityKeys: {
    title: 'Add identity keys',
    subtitle: 'Choose the keys to add to this identity.',
    back: 'Back to keys',
  },
  masternodes: {
    title: 'Masternodes',
    subtitle: 'Your nodes and their votes on contested usernames.',
  },
  nameContest: {
    back: 'Back to name contests',
  },
  masternodeDetail: {
    back: 'Back to nodes',
  },
  shielded: {
    title: 'Shielded',
    subtitle: 'Send and hold credits privately.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Wallet, appearance, logging and connection preferences.',
  },
  logs: {
    title: 'Application logs',
    subtitle: 'Diagnostic logs. May include wallet addresses — review before sharing.',
    back: 'Back to settings',
  },
  connectionSettings: {
    title: 'Connection settings',
    subtitle: 'How the wallet connects to Core and Platform.',
    back: 'Go back',
  },
}
