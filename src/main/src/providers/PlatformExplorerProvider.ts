import {
  PLATFORM_EXPLORER_ADDRESS_CHUNK,
  PLATFORM_EXPLORER_ADDRESS_SOURCE,
  PLATFORM_EXPLORER_BASE_URLS,
  PLATFORM_EXPLORER_MAX_PAGES,
  PLATFORM_EXPLORER_PAGE_LIMIT,
  PLATFORM_EXPLORER_REQUEST_TIMEOUT_MS,
  PLATFORM_EXPLORER_RETRY_DELAYS_MS,
} from '../constants/platformExplorer'
import {PlatformTransactionDAO} from '../database/PlatformTransactionDAO'
import {JsonRequest} from '../types/JsonRequest'
import {Network} from '../types/Network'
import {
  PlatformExplorerAddressTransition,
  PlatformExplorerPage,
  PlatformExplorerTransfer,
} from '../types/PlatformExplorer'
import {PlatformTransaction} from '../types/PlatformTransaction'
import {chunk} from '../utils/chunk'
import {
  addressTransitionToPlatformTransaction,
  transferToPlatformTransaction,
} from '../utils/platformExplorerTransactions'
import {requestJson} from '../utils/requestJson'

// Not a WalletProvider and never reaches forWallet(): L2 history has one source,
// and the index is unproven, so it feeds what is rendered, never what is signed.
export class PlatformExplorerProvider {
  private request: JsonRequest
  private transactionDAO: PlatformTransactionDAO

  constructor(network: Network, transactionDAO: PlatformTransactionDAO) {
    this.request = {
      baseUrl: PLATFORM_EXPLORER_BASE_URLS[network],
      source: 'Platform explorer',
      timeoutMs: PLATFORM_EXPLORER_REQUEST_TIMEOUT_MS,
      retryDelaysMs: PLATFORM_EXPLORER_RETRY_DELAYS_MS,
    }
    this.transactionDAO = transactionDAO
  }

  // The name carries its chunk's membership, so an address the window reveals
  // later lands in a source with no rows behind it to stop the walk early.
  addressChunks(addresses: string[]): {source: string, slice: string[]}[] {
    return chunk(addresses, PLATFORM_EXPLORER_ADDRESS_CHUNK).map((slice, index) => ({
      source: `${PLATFORM_EXPLORER_ADDRESS_SOURCE}:${index}:${slice.length}`,
      slice,
    }))
  }

  // Addresses the indexer has never seen are dropped, not rejected, so an unused
  // stretch of the window costs nothing but the bytes to ask.
  async addressTransactions(addresses: string[], walletId: string): Promise<boolean> {
    const walks = this.addressChunks(addresses).map(({source, slice}) =>
      this.walk<PlatformExplorerAddressTransition>(
        walletId,
        source,
        page => requestJson(
          this.request,
          `/platformAddresses/transitions?page=${page}&limit=${PLATFORM_EXPLORER_PAGE_LIMIT}&order=desc`,
          {addresses: slice},
        ),
        row => row.hash,
        rows => rows.map(row => addressTransitionToPlatformTransaction(row, walletId)),
      ))

    return (await Promise.all(walks)).some(truncated => truncated)
  }

  // One walk per identity: the explorer batches addresses but not these, and
  // each identity is its own stream to resume.
  async identityTransactions(identifier: string, walletId: string): Promise<boolean> {
    return this.walk<PlatformExplorerTransfer>(
      walletId,
      identifier,
      page => requestJson(
        this.request,
        `/identity/${identifier}/transfers?page=${page}&limit=${PLATFORM_EXPLORER_PAGE_LIMIT}&order=desc`,
      ),
      row => row.txHash,
      rows => rows.map(row => transferToPlatformTransaction(row, identifier, walletId)),
    )
  }

  // An empty result set reports a total of -1, so the walk ends on a short page
  // instead of on the count. Rows come newest first.
  private async walk<T>(
    walletId: string,
    source: string,
    read: (page: number) => Promise<PlatformExplorerPage<T>>,
    hashOf: (row: T) => string,
    convert: (rows: T[]) => PlatformTransaction[],
  ): Promise<boolean> {
    const known = await this.transactionDAO.getKnownHashes(walletId, source)

    for (let page = 1; page <= PLATFORM_EXPLORER_MAX_PAGES; page++) {
      const {resultSet} = await read(page)
      // Stored rows are written again: a transition read before its block was
      // indexed carries neither height nor status until a page repeats it.
      if (resultSet.length > 0) await this.transactionDAO.upsertTransactions(source, convert(resultSet))
      if (resultSet.length < PLATFORM_EXPLORER_PAGE_LIMIT) return false
      if (resultSet.every(row => known.has(hashOf(row)))) return false
    }

    return true
  }
}
