import {Block, Script, Transaction as SDKTransaction} from 'dash-core-sdk'
import {UTXO} from '../types/UTXO'
import {WalletProvider} from './WalletProvider'
import {Network} from '../types'
import {Transaction} from '../types/Transaction'
import {AddressDAO} from '../database/AddressDAO'
import {processProviderTransactions} from '../utils'
import {TransactionWalletProviderJSON} from './types'

const BASE_URLS: Record<Network, string> = {
  mainnet: 'https://insight.dash.org/insight-api',
  testnet: 'https://insight.testnet.networks.dash.org/insight-api'
}

export interface InsightUTXO {
  txid: string
  vout: number
  address: string
  scriptPubKey: string
  satoshis: number
  height: number
  confirmations: number
}

export class InsightWalletProvider implements WalletProvider {
  private baseUrl: string

  constructor(
    network: Network,
    private readonly walletId: string,
    private readonly addressDAO: AddressDAO,
  ) {
    this.baseUrl = BASE_URLS[network]
  }

  async sendRequest(url: string, params?: RequestInit): Promise<Response> {
    const response = await fetch(url, params)

    if (!response.ok) {
      throw new Error(`Insight API error: ${response.status}`)
    }

    return response
  }

  async getTransactions(address: string): Promise<Transaction[]> {
    const response = await this.sendRequest(`${this.baseUrl}/txs/?address=${address}`)

    const data = await response.json() as { txs: TransactionWalletProviderJSON[] }

    const allAddresses = await this.allWalletAddresses()
    return processProviderTransactions(data.txs, this.walletId, allAddresses)
  }

  async getBalance(address: string | string[]): Promise<bigint> {
    const endpoint = Array.isArray(address) ? 'addrs' : 'addr'
    const parameter = Array.isArray(address) ? address.join(',') : address

    const response = await this.sendRequest(`${this.baseUrl}/${endpoint}/${parameter}/balance`)

    const data = await response.text()

    return BigInt(data)
  }

  async getTransactionByHash(txId: string): Promise<Transaction> {
    const response = await this.sendRequest(`${this.baseUrl}/tx/${txId}`)

    const json = await response.json() as TransactionWalletProviderJSON

    const allAddresses = await this.allWalletAddresses()
    const [tx] = processProviderTransactions([json], this.walletId, allAddresses)
    return tx
  }

  async getBlockByHash(hash: string): Promise<Block> {
    const response = await this.sendRequest(`${this.baseUrl}/rawblock/${hash}`)

    const data = await response.json() as { rawblock: string }

    return Block.fromHex(data.rawblock)
  }

  async getUTXOs(address: string): Promise<UTXO[]> {
    const response = await this.sendRequest(`${this.baseUrl}/addr/${address}/utxo`)

    const data = await response.json() as InsightUTXO[]

    return data.map((utxo) => ({
      txId: utxo.txid,
      vOut: utxo.vout,
      satoshis: BigInt(utxo.satoshis),
      script: Script.fromHex(utxo.scriptPubKey)
    }))
  }

  async broadcastTx(tx: SDKTransaction): Promise<string> {
    const response = await this.sendRequest(`${this.baseUrl}/tx/send`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({rawtx: tx.hex()})
    })

    const data = await response.json() as { txid: string }

    return data.txid
  }

  private async allWalletAddresses() {
    const grouped = await this.addressDAO.getAddressesByWalletId(this.walletId)
    return [...grouped.change, ...grouped.receiving]
  }
}