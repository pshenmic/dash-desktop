import {
  PLATFORM_EXPLORER_ADDRESS_CHUNK,
  PLATFORM_EXPLORER_BASE_URLS,
  PLATFORM_EXPLORER_MAX_PAGES,
  PLATFORM_EXPLORER_PAGE_LIMIT,
  PLATFORM_EXPLORER_REQUEST_TIMEOUT_MS,
  PLATFORM_EXPLORER_RETRY_DELAYS_MS,
} from '../constants/platformExplorer'
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

// Everything the wallet reads from the platform explorer, in the wallet's own
// vocabulary: callers name addresses and identities and get transactions back,
// and no endpoint, page or wire shape escapes this class.
//
// It is not a WalletProvider and never reaches forWallet(). L2 history has one
// source, so there is nothing for connectionType to choose between. The index
// is also unproven, which bounds what may ever be asked of it: what gets
// rendered, never what gets signed or spent — those come from the worker, where
// Drive's proofs are checked.
export class PlatformExplorerProvider {
  private request: JsonRequest

  constructor(network: Network) {
    this.request = {
      baseUrl: PLATFORM_EXPLORER_BASE_URLS[network],
      source: 'Platform explorer',
      timeoutMs: PLATFORM_EXPLORER_REQUEST_TIMEOUT_MS,
      retryDelaysMs: PLATFORM_EXPLORER_RETRY_DELAYS_MS,
    }
  }

  // Every credit movement across a set of platform addresses. Addresses the
  // indexer has never seen are dropped rather than rejected, so an unused
  // stretch of the window costs nothing but the bytes to ask.
  async addressTransactions(addresses: string[], walletId: string, known: Set<string>): Promise<PlatformTransaction[]> {
    const pages = await Promise.all(chunk(addresses, PLATFORM_EXPLORER_ADDRESS_CHUNK).map(slice =>
      this.walkPages<PlatformExplorerAddressTransition>(
        page => requestJson(
          this.request,
          `/platformAddresses/transitions?page=${page}&limit=${PLATFORM_EXPLORER_PAGE_LIMIT}&order=desc`,
          {addresses: slice},
        ),
        row => row.hash,
        known,
      )
    ))

    return pages.flat().map(row => addressTransitionToPlatformTransaction(row, walletId))
  }

  // One walk per identity: the explorer batches addresses but not these, and
  // each identity is its own stream to resume.
  async identityTransactions(identifier: string, walletId: string, known: Set<string>): Promise<PlatformTransaction[]> {
    const transfers = await this.walkPages<PlatformExplorerTransfer>(
      page => requestJson(
        this.request,
        `/identity/${identifier}/transfers?page=${page}&limit=${PLATFORM_EXPLORER_PAGE_LIMIT}&order=desc`,
      ),
      row => row.txHash,
      known,
    )

    return transfers.map(row => transferToPlatformTransaction(row, identifier, walletId))
  }

  // An empty result set reports a total of -1 rather than 0, so the walk ends
  // on a short page instead of on the count. Rows come newest first, so a page
  // we already hold in full has nothing behind it we do not.
  private async walkPages<T>(
    read: (page: number) => Promise<PlatformExplorerPage<T>>,
    hashOf: (row: T) => string,
    known: Set<string>,
  ): Promise<T[]> {
    const rows: T[] = []

    for (let page = 1; page <= PLATFORM_EXPLORER_MAX_PAGES; page++) {
      const {resultSet} = await read(page)
      rows.push(...resultSet.filter(row => !known.has(hashOf(row))))
      if (resultSet.length < PLATFORM_EXPLORER_PAGE_LIMIT) break
      if (resultSet.every(row => known.has(hashOf(row)))) break
    }

    return rows
  }
}
