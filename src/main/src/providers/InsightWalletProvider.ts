import {Block, Script, Transaction as SDKTransaction} from 'dash-core-sdk'
import { net } from 'electron'
import {UTXO} from '../types/UTXO'
import {WalletProvider} from './WalletProvider'
import {Network} from '../types'
import {Transaction} from '../types/Transaction'
import {AddressDAO} from '../database/AddressDAO'
import {processProviderTransactions} from '../utils'
import {TransactionWalletProviderJSON} from './types'
import {TxLockStatus} from '../types/TxLockStatus'

const BASE_URLS: Record<Network, string> = {
  mainnet: 'https://insight.dash.org/insight-api',
  testnet: 'https://insight.testnet.networks.dash.org/insight-api'
}

const BALANCE_ADDRESS_CHUNK = 25

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
    const response = await net.fetch(url, params as RequestInit)

    if (!response.ok) {
      const body = (await response.text().catch(() => '')).slice(0, 500)
      throw new Error(`Insight API error: ${response.status}${body ? ` — ${body}` : ''}`)
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
    if (!Array.isArray(address)) {
      const response = await this.sendRequest(`${this.baseUrl}/addr/${address}/balance`)
      return BigInt(await response.text())
    }

    if (address.length === 0) return 0n

    const chunks: string[][] = []
    for (let i = 0; i < address.length; i += BALANCE_ADDRESS_CHUNK) {
      chunks.push(address.slice(i, i + BALANCE_ADDRESS_CHUNK))
    }

    const balances = await Promise.all(chunks.map(async (chunk) => {
      const response = await this.sendRequest(`${this.baseUrl}/addrs/${chunk.join(',')}/balance`)
      return BigInt(await response.text())
    }))

    return balances.reduce((acc, value) => acc + value, 0n)
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

  async ensureReady(): Promise<void> {}

  async broadcastTx(tx: SDKTransaction): Promise<string> {
    const response = await this.sendRequest(`${this.baseUrl}/tx/send`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({rawtx: tx.hex()})
    })

    const data = await response.json() as { txid: string }

    return data.txid
  }

  async getTxLockStatus(txid: string): Promise<TxLockStatus> {
    try {
      const response = await this.sendRequest(`${this.baseUrl}/tx/${txid}`)
      const data = await response.json() as Partial<Pick<TransactionWalletProviderJSON, 'txlock' | 'confirmations'>>
      return {
        instantLocked: data.txlock === true,
        chainlocked: false,
        confirmed: (data.confirmations ?? 0) > 0,
      }
    } catch {
      return {instantLocked: false, chainlocked: false, confirmed: false}
    }
  }

  async nextUnusedAddress(): Promise<string> {
    const { receiving } = await this.addressDAO.getAddressesByWalletId(this.walletId)
    if (receiving.length === 0) throw new Error('Wallet has no receiving addresses')
    const unused = receiving.find(a => !a.isUsed)
    return (unused ?? receiving[receiving.length - 1]).address
  }

  async getUsedAddresses(addresses: string[]): Promise<string[]> {
    if (addresses.length === 0) return []

    const probe = await this.sendRequest(`${this.baseUrl}/addrs/txs`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({addrs: addresses.join(','), from: 0, to: 1})
    })
    const {totalItems} = await probe.json() as { totalItems: number }
    if (!totalItems) return []

    const flags = await Promise.all(addresses.map(async (address) => {
      const response = await this.sendRequest(`${this.baseUrl}/addr/${address}?noTxList=1`)
      const info = await response.json() as { txApperances?: number; unconfirmedTxApperances?: number }
      return (info.txApperances ?? 0) + (info.unconfirmedTxApperances ?? 0) > 0
    }))

    return addresses.filter((_, i) => flags[i])
  }

  private async allWalletAddresses() {
    const grouped = await this.addressDAO.getAddressesByWalletId(this.walletId)
    return [...grouped.change, ...grouped.receiving]
  }
}