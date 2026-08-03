export interface InsightUTXO {
  txid: string
  vout: number
  address: string
  scriptPubKey: string
  satoshis: number
  height: number
  confirmations: number
}

export interface InputWalletProviderJSON {
  txid: string,
  vout: number,
  sequence: number,
  n: number,
  scriptSig: {
    hex: string,
    asm: string
  },
  addr: string,
  valueSat: number,
  value: number,
}

export interface OutputWalletProviderJSON {
  value: string,
  n: number,
  scriptPubKey: {
    hex: string,
    asm: string,
    addresses?: string[],
    type: string
  },
  spentTxId: string,
  spentIndex: number,
  spentHeight: number
}

export interface TransactionWalletProviderJSON {
  txid: string,
  version: number,
  locktime: number,
  vin: InputWalletProviderJSON[],
  vout: OutputWalletProviderJSON[],
  blockhash: string,
  blockheight: number,
  confirmations: number,
  time: number,
  blockTime: number,
  valueOut: number,
  size: number,
  valueIn: number,
  fees: number,
  txlock: boolean,
}

export interface AliasPlatformProviderJSON {
  "alias": string,
  "status": string,
  "contested": boolean,
  "timestamp": string,
  "txHash": string
}

export interface IdentityPlatformProviderJSON {
  identifier: string,
  revision: string,
  balance: string,
  timestamp: string,
  aliases: AliasPlatformProviderJSON[],
}
