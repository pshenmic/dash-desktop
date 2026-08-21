import {Script} from 'dash-core-sdk'
import {net} from 'electron'
import {UTXO} from '../types/UTXO'
import {AddressInfo} from '../types/AddressInfo'
import {WalletProvider} from './WalletProvider'
import {Transaction} from '../types/Transaction'
import {AddressDAO} from '../database/AddressDAO'
import {WalletDAO} from '../database/WalletDAO'
import {dashscanToWalletTransactions} from '../utils/dashscanTransactions'
import {dedupeTransactions} from '../utils/dedupeTransactions'
import {
  DashscanAddressInfo,
  DashscanCursorPage,
  DashscanRequestError,
  DashscanPage,
  DashscanTransaction,
  DashscanUTXO,
  DashscanXpubAddress,
  DashscanXpubSummary,
} from '../types/Dashscan'
import {TxLockStatus} from '../types/TxLockStatus'
import {AddressUsage} from '../types/AddressDiscovery'
import {Network} from '../types/Network'
import {ConnectionStatus} from '../types/ConnectionStatus'
import {
  ADDRESS_LOOKAHEAD,
  DASHSCAN_ADDRESS_CHUNK,
  DASHSCAN_BASE_URLS,
  DASHSCAN_REQUEST_TIMEOUT_MS,
  DASHSCAN_STATUS_INTERVAL_MS,
  DASHSCAN_RETRY_DELAYS_MS,
  XPUB_MAX_PAGES,
  XPUB_PAGE_LIMIT,
} from '../constants'

const dashscanConnectionStatusCache = {
  statuses: new Map<Network, ConnectionStatus>(),
  checkedAt: new Map<Network, number>(),
  inflight: new Map<Network, Promise<void>>(),
}

export class DashscanWalletProvider implements WalletProvider {
  private baseUrl: string

  constructor(
    private readonly network: Network,
    private readonly walletId: string,
    private readonly addressDAO: AddressDAO,
    private readonly walletDAO: WalletDAO,
  ) {
    this.baseUrl = DASHSCAN_BASE_URLS[network]
  }

  // Every call through here is a read — broadcast runs over the p2p pool — so a
  // retry can never resend a transaction.
  async sendRequest<T>(path: string, payload?: unknown): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt <= DASHSCAN_RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, DASHSCAN_RETRY_DELAYS_MS[attempt - 1]))

      let response: Response
      try {
        response = await net.fetch(`${this.baseUrl}${path}`, {
          signal: AbortSignal.timeout(DASHSCAN_REQUEST_TIMEOUT_MS),
          ...(payload != null
            ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)}
            : {}),
        })
      } catch (err) {
        lastError = err
        continue
      }

      if (response.ok) return await response.json() as T

      const body = (await response.text().catch(() => '')).slice(0, 500)
      lastError = Object.assign(
        new Error(`${response.status}${body ? ` — ${body}` : ''}`),
        {status: response.status},
      )
      // 4xx is our request being wrong; repeating it just wastes the deadline.
      if (response.status < 500 && response.status !== 429) break
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError)
    throw Object.assign(
      new Error(`Dashscan request failed (${path}): ${detail}`),
      {status: (lastError as {status?: number}).status ?? null},
    ) as DashscanRequestError
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

  // Set at creation and backfilled on login, so its absence is a bug rather
  // than an older wallet format.
  private async requireXpub(): Promise<string> {
    const wallet = await this.walletDAO.getWalletById(this.walletId)
    if (wallet?.coreXpub == null) {
      throw new Error(`Wallet ${this.walletId} has no account xpub — reopen the wallet to derive it`)
    }
    return wallet.coreXpub
  }

  // Pending transactions ride along on the first page only, so the walk has to
  // start without a cursor to see them.
  async getWalletTransactions(): Promise<Transaction[]> {
    const xpub = await this.requireXpub()
    const collected: DashscanTransaction[] = []
    let cursor: string | null = null

    for (let page = 0; page < XPUB_MAX_PAGES; page++) {
      const {resultSet, pagination}: DashscanCursorPage<DashscanTransaction> =
        await this.sendRequest<DashscanCursorPage<DashscanTransaction>>('/xpub/transactions', {
          xpub,
          gap_limit: ADDRESS_LOOKAHEAD,
          limit: XPUB_PAGE_LIMIT,
          ...(cursor != null ? {cursor} : {}),
        })

      collected.push(...resultSet)
      if (pagination.nextCursor == null || pagination.nextCursor === cursor) break
      cursor = pagination.nextCursor
    }

    const owned = await this.allWalletAddresses()
    return dedupeTransactions(dashscanToWalletTransactions(collected, this.walletId, owned))
  }

  // No wallet-wide endpoint carries per-address balance or tx count.
  async getAddressInfos(addresses: string[]): Promise<AddressInfo[]> {
    if (addresses.length === 0) return []

    const [utxos, transactions] = await Promise.all([this.getWalletUtxos(), this.getWalletTransactions()])

    const balances = new Map<string, bigint>()
    for (const utxo of utxos) {
      balances.set(utxo.address, (balances.get(utxo.address) ?? 0n) + utxo.satoshis)
    }

    // One transaction touching an address on both sides still counts once.
    const counts = new Map<string, number>()
    for (const transaction of transactions) {
      const touched = new Set<string>()
      for (const input of transaction.vin) if (input.addr !== '') touched.add(input.addr)
      for (const output of transaction.vout) if (output.address !== '') touched.add(output.address)
      for (const address of touched) counts.set(address, (counts.get(address) ?? 0) + 1)
    }

    return addresses.map(address => ({
      address,
      balance: balances.get(address) ?? 0n,
      txCount: counts.get(address) ?? 0,
    }))
  }

  // Summed over the server's own gap walk, and includes unconfirmed outputs.
  async getWalletBalance(): Promise<bigint> {
    const xpub = await this.requireXpub()
    const {balance} = await this.sendRequest<DashscanXpubSummary>('/xpub', {
      xpub,
      gap_limit: ADDRESS_LOOKAHEAD,
    })

    return BigInt(balance)
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

  // The server's gap walk decides the address set, so this sees coins on an
  // index our local window has not derived yet.
  async getWalletUtxos(): Promise<UTXO[]> {
    const xpub = await this.requireXpub()
    const collected: DashscanUTXO[] = []

    for (let page = 1; ; page++) {
      const {resultSet, pagination} = await this.sendRequest<DashscanPage<DashscanUTXO>>('/xpub/utxo', {
        xpub,
        gap_limit: ADDRESS_LOOKAHEAD,
        page,
        limit: XPUB_PAGE_LIMIT,
      })

      collected.push(...resultSet)
      if (resultSet.length < XPUB_PAGE_LIMIT || collected.length >= pagination.total) break
    }

    return collected
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
    const response = await net.fetch(`${this.baseUrl}/status`, {
      signal: AbortSignal.timeout(DASHSCAN_REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Dashscan status request failed (${response.status})`)
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    const checkedAt = dashscanConnectionStatusCache.checkedAt.get(this.network)
    const fresh = checkedAt != null && Date.now() - checkedAt < DASHSCAN_STATUS_INTERVAL_MS

    if (!fresh && !dashscanConnectionStatusCache.inflight.has(this.network)) {
      const refresh = Promise.resolve()
        .then(() => this.ensureReady())
        .then(() => dashscanConnectionStatusCache.statuses.set(this.network, 'connected'))
        .catch(() => dashscanConnectionStatusCache.statuses.set(this.network, 'unavailable'))
        .then(() => undefined)
        .finally(() => {
          dashscanConnectionStatusCache.checkedAt.set(this.network, Date.now())
          dashscanConnectionStatusCache.inflight.delete(this.network)
        })

      dashscanConnectionStatusCache.inflight.set(this.network, refresh)
    }

    return dashscanConnectionStatusCache.statuses.get(this.network) ?? 'connecting'
  }

  async getTxLockStatus(txid: string): Promise<TxLockStatus> {
    try {
      const tx = await this.sendRequest<DashscanTransaction>(`/transaction/${txid}`)
      return {
        instantLocked: tx.instantLock != null,
        chainlocked: tx.chainLocked === true,
        confirmed: (tx.confirmations ?? 0) > 0,
      }
    } catch (err) {
      // 404 is the indexer saying it has never seen the transaction, the same
      // claim the local store makes. Any other failure is not an answer at all.
      if ((err as DashscanRequestError).status === 404) {
        return {instantLocked: false, chainlocked: false, confirmed: false}
      }
      throw err
    }
  }

  async nextUnusedAddress(): Promise<string> {
    const { receiving } = await this.addressDAO.getAddressesByWalletId(this.walletId)
    if (receiving.length === 0) throw new Error('Wallet has no receiving addresses')
    const unused = receiving.find(a => !a.isUsed)
    return (unused ?? receiving[receiving.length - 1]).address
  }

  // Only branch, index and usage are kept: a server-supplied address string
  // would let a compromised indexer seed the wallet with one we cannot spend.
  async scanAddressUsage(gapLimit: number): Promise<AddressUsage[] | null> {
    const xpub = await this.requireXpub()
    const usage: AddressUsage[] = []

    for (let page = 1; ; page++) {
      const {resultSet, pagination} = await this.sendRequest<DashscanPage<DashscanXpubAddress>>(
        '/xpub/addresses',
        {xpub, gap_limit: gapLimit, page, limit: XPUB_PAGE_LIMIT},
      )

      usage.push(...resultSet.map(entry => ({
        isChange: entry.branch === 1,
        index: entry.index,
        isUsed: entry.used,
      })))

      if (resultSet.length < XPUB_PAGE_LIMIT || usage.length >= pagination.total) break
    }

    return usage
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
