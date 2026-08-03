import {Block, Script} from 'dash-core-sdk'
import { net } from 'electron'
import {UTXO} from '../types/UTXO'
import {WalletProvider} from './WalletProvider'
import {Transaction} from '../types/Transaction'
import {AddressDAO} from '../database/AddressDAO'
import {processProviderTransactions} from '../utils'
import {InsightUTXO, TransactionWalletProviderJSON} from './types'
import {TxLockStatus} from '../types/TxLockStatus'
import {Address} from "../types/Address";
import {Network} from '../types'
import {
  INSIGHT_ADDRESS_CHUNK,
  INSIGHT_BASE_URLS,
  INSIGHT_REQUEST_TIMEOUT_MS,
  INSIGHT_RETRY_DELAYS_MS,
} from '../constants'

export class InsightWalletProvider implements WalletProvider {
  private baseUrl: string

  constructor(
    network: Network,
    private readonly walletId: string,
    private readonly addressDAO: AddressDAO,
  ) {
    this.baseUrl = INSIGHT_BASE_URLS[network]
  }

  // Every call through here is a read now that broadcast runs over the p2p
  // pool, so a retry can never resend a transaction. Insight drops connections
  // intermittently and a send fans out one request per address, so without
  // this a single blip fails the whole send.
  async sendRequest(url: string, params?: RequestInit): Promise<Response> {
    let lastError: unknown

    for (let attempt = 0; attempt <= INSIGHT_RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, INSIGHT_RETRY_DELAYS_MS[attempt - 1]))

      let response: Response
      try {
        response = await net.fetch(url, {...params, signal: AbortSignal.timeout(INSIGHT_REQUEST_TIMEOUT_MS)} as RequestInit)
      } catch (err) {
        lastError = err
        continue
      }

      if (response.ok) return response

      const body = (await response.text().catch(() => '')).slice(0, 500)
      lastError = new Error(`${response.status}${body ? ` — ${body}` : ''}`)
      // 4xx is our request being wrong; repeating it just wastes the deadline.
      if (response.status < 500 && response.status !== 429) break
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(`Insight request failed (${url}): ${detail}`)
  }

  async getTransactions(address: string): Promise<Transaction[]> {
    const response = await this.sendRequest(`${this.baseUrl}/txs/?address=${address}`)

    const data = await response.json() as { txs: TransactionWalletProviderJSON[] }

    const allAddresses = await this.allWalletAddresses()
    return processProviderTransactions(data.txs, this.walletId, allAddresses)
  }

  async getTransactionCount(address: string): Promise<number> {
    const response = await this.sendRequest(`${this.baseUrl}/addr/${address}?noTxList=1`)
    const info = await response.json() as { txApperances?: number; unconfirmedTxApperances?: number }
    return (info.txApperances ?? 0) + (info.unconfirmedTxApperances ?? 0)
  }

  async getBalance(address: string | string[]): Promise<bigint> {
    if (!Array.isArray(address)) {
      const response = await this.sendRequest(`${this.baseUrl}/addr/${address}/balance`)
      return BigInt(await response.text())
    }

    if (address.length === 0) return 0n

    const chunks: string[][] = []
    for (let i = 0; i < address.length; i += INSIGHT_ADDRESS_CHUNK) {
      chunks.push(address.slice(i, i + INSIGHT_ADDRESS_CHUNK))
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

  // Batched: a send asks for every address at once, and one request per address
  // put ~40 of them on the wire. Measured against testnet Insight, 40 parallel
  // /addr/:a/utxo took 5.1s and lost 2 requests to dropped connections, while
  // the same set as two /addrs/:list/utxo calls took 1.0s and lost none.
  async getUTXOs(address: string | string[]): Promise<UTXO[]> {
    const addresses = Array.isArray(address) ? address : [address]
    if (addresses.length === 0) return []

    const chunks: string[][] = []
    for (let i = 0; i < addresses.length; i += INSIGHT_ADDRESS_CHUNK) {
      chunks.push(addresses.slice(i, i + INSIGHT_ADDRESS_CHUNK))
    }

    const results = await Promise.all(chunks.map(async (chunk) => {
      const response = await this.sendRequest(`${this.baseUrl}/addrs/${chunk.join(',')}/utxo`)
      return await response.json() as InsightUTXO[]
    }))

    return results.flat().map((utxo) => ({
      address: utxo.address,
      txId: utxo.txid,
      vOut: utxo.vout,
      satoshis: BigInt(utxo.satoshis),
      script: Script.fromHex(utxo.scriptPubKey)
    }))
  }

  async ensureReady(): Promise<void> {
    // empty
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

  private async allWalletAddresses(): Promise<Address[]> {
    const grouped = await this.addressDAO.getAddressesByWalletId(this.walletId)
    return [...grouped.change, ...grouped.receiving]
  }
}
