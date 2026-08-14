import {Script} from 'dash-core-sdk'
import {net} from 'electron'
import {UTXO} from '../types/UTXO'
import {AddressInfo} from '../types/AddressInfo'
import {WalletProvider} from './WalletProvider'
import {Transaction} from '../types/Transaction'
import {AddressDAO} from '../database/AddressDAO'
import {dashscanToWalletTransactions} from '../utils/dashscanTransactions'
import {DashscanAddressInfo, DashscanPage, DashscanTransaction, DashscanUTXO} from '../types/Dashscan'
import {TxLockStatus} from '../types/TxLockStatus'
import {Network} from '../types'
import {
  DASHSCAN_ADDRESS_CHUNK,
  DASHSCAN_BASE_URLS,
  DASHSCAN_PAGE_LIMIT,
  DASHSCAN_REQUEST_TIMEOUT_MS,
  DASHSCAN_RETRY_DELAYS_MS,
} from '../constants'

export class DashscanWalletProvider implements WalletProvider {
  private baseUrl: string

  constructor(
    network: Network,
    private readonly walletId: string,
    private readonly addressDAO: AddressDAO,
  ) {
    this.baseUrl = DASHSCAN_BASE_URLS[network]
  }

  // Every call through here is a read — broadcast runs over the p2p pool — so a
  // retry can never resend a transaction.
  async sendRequest<T>(path: string): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt <= DASHSCAN_RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, DASHSCAN_RETRY_DELAYS_MS[attempt - 1]))

      let response: Response
      try {
        response = await net.fetch(`${this.baseUrl}${path}`, {signal: AbortSignal.timeout(DASHSCAN_REQUEST_TIMEOUT_MS)})
      } catch (err) {
        lastError = err
        continue
      }

      if (response.ok) return await response.json() as T

      const body = (await response.text().catch(() => '')).slice(0, 500)
      lastError = new Error(`${response.status}${body ? ` — ${body}` : ''}`)
      // 4xx is our request being wrong; repeating it just wastes the deadline.
      if (response.status < 500 && response.status !== 429) break
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(`Dashscan request failed (${path}): ${detail}`)
  }

  private chunkAddresses(addresses: string[]): string[][] {
    const chunks: string[][] = []
    for (let i = 0; i < addresses.length; i += DASHSCAN_ADDRESS_CHUNK) {
      chunks.push(addresses.slice(i, i + DASHSCAN_ADDRESS_CHUNK))
    }
    return chunks
  }

  private async addressInfo(addresses: string[]): Promise<DashscanAddressInfo[]> {
    const chunks = await Promise.all(this.chunkAddresses(addresses).map(chunk =>
      this.sendRequest<DashscanAddressInfo[]>(`/addresses/info?addresses=${chunk.join(',')}`)
    ))
    return chunks.flat()
  }

  async getTransactions(address: string): Promise<Transaction[]> {
    const collected: DashscanTransaction[] = []

    // Pagination is mandatory here and the wallet needs the whole history, so
    // walk pages until the reported total is covered.
    for (let page = 1; ; page++) {
      const {resultSet, pagination} = await this.sendRequest<DashscanPage<DashscanTransaction>>(
        `/address/${address}/transactions?page=${page}&limit=${DASHSCAN_PAGE_LIMIT}&order=desc`
      )

      collected.push(...resultSet)
      if (resultSet.length < DASHSCAN_PAGE_LIMIT || collected.length >= pagination.total) break
    }

    const owned = await this.allWalletAddresses()
    return dashscanToWalletTransactions(collected, this.walletId, owned)
  }

  async getAddressInfos(addresses: string[]): Promise<AddressInfo[]> {
    if (addresses.length === 0) return []

    const infos = await this.addressInfo(addresses)
    const byAddress = new Map(infos.map(info => [info.address, info]))

    // An address the API omits has never been seen on chain.
    return addresses.map(address => {
      const info = byAddress.get(address)
      return {address, balance: BigInt(info?.balance ?? 0), txCount: info?.txCount ?? 0}
    })
  }

  async getBalance(address: string | string[]): Promise<bigint> {
    const addresses = Array.isArray(address) ? address : [address]
    if (addresses.length === 0) return 0n

    const infos = await this.addressInfo(addresses)
    return infos.reduce((sum, info) => sum + BigInt(info.balance), 0n)
  }

  async getTransactionByHash(txId: string): Promise<Transaction> {
    const tx = await this.sendRequest<DashscanTransaction>(`/transaction/${txId}`)

    const owned = await this.allWalletAddresses()
    const [transaction] = dashscanToWalletTransactions([tx], this.walletId, owned)
    return transaction
  }

  // Batched: a send asks for every address at once, and /addresses/utxo answers
  // 100 of them in one unpaginated call.
  async getUTXOs(address: string | string[]): Promise<UTXO[]> {
    const addresses = Array.isArray(address) ? address : [address]
    if (addresses.length === 0) return []

    const results = await Promise.all(this.chunkAddresses(addresses).map(chunk =>
      this.sendRequest<DashscanUTXO[]>(`/addresses/utxo?addresses=${chunk.join(',')}`)
    ))

    return results.flat()
      .filter(utxo => utxo.prevTxHash != null && utxo.vOutIndex != null && utxo.scriptPubKeyHex != null)
      .map(utxo => ({
        address: utxo.address ?? '',
        txId: utxo.prevTxHash as string,
        vOut: utxo.vOutIndex as number,
        satoshis: BigInt(utxo.amount ?? '0'),
        script: Script.fromHex(utxo.scriptPubKeyHex as string)
      }))
  }

  async ensureReady(): Promise<void> {
    // empty
  }

  async getTxLockStatus(txid: string): Promise<TxLockStatus> {
    try {
      const tx = await this.sendRequest<DashscanTransaction>(`/transaction/${txid}`)
      return {
        instantLocked: tx.instantLock != null,
        chainlocked: tx.chainLocked === true,
        confirmed: (tx.confirmations ?? 0) > 0,
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

    const infos = await this.addressInfo(addresses)
    return infos.filter(info => info.txCount > 0).map(info => info.address)
  }

  // A provider instance serves one operation, and getTransactions runs once per
  // address within it.
  private ownedAddresses: Promise<string[]> | null = null

  private allWalletAddresses(): Promise<string[]> {
    this.ownedAddresses ??= this.addressDAO.getAddressesByWalletId(this.walletId)
      .then(grouped => [...grouped.change, ...grouped.receiving].map(({address}) => address))
    return this.ownedAddresses
  }
}