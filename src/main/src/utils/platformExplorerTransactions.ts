import {PlatformExplorerAddressTransition, PlatformExplorerTransfer} from '../types/PlatformExplorer'
import {PlatformTransaction, PlatformTxStatus} from '../types/PlatformTransaction'

const credits = (value: string | null): bigint => value == null ? 0n : BigInt(value)

// A transition is only listed once a block carries it, so a missing timestamp
// means the block row is missing rather than that the transition is pending.
const transitionDate = (value: string | null): Date => value != null ? new Date(value) : new Date(0)

const transitionStatus = (value: string | null): PlatformTxStatus | null =>
  value === 'SUCCESS' || value === 'FAIL' ? value : null

export function addressTransitionToPlatformTransaction(
  row: PlatformExplorerAddressTransition,
  walletId: string,
): PlatformTransaction {
  return {
    walletId,
    hash: row.hash,
    type: row.type,
    date: transitionDate(row.timestamp),
    blockHeight: row.blockHeight,
    status: transitionStatus(row.status),
    error: row.error,
    gasCredits: BigInt(row.gasUsed ?? 0),
    netCredits: credits(row.amount),
    // bech32m: the form platform_addresses holds. The base58 field is the same
    // key in an encoding nothing in this wallet is stored under.
    subject: (row.addressesCount ?? 1) > 1 ? null : row.bech32mAddress,
    counterparty: null,
  }
}

export function transferToPlatformTransaction(
  row: PlatformExplorerTransfer,
  identifier: string,
  walletId: string,
): PlatformTransaction {
  const amount = credits(row.amount)
  const received = row.recipient === identifier ? amount : 0n
  const sent = row.sender === identifier ? amount : 0n
  const counterparty = row.recipient === identifier ? row.sender : row.recipient

  return {
    walletId,
    hash: row.txHash,
    type: row.type,
    date: transitionDate(row.timestamp),
    blockHeight: null,
    status: null,
    error: null,
    gasCredits: BigInt(row.gasUsed ?? 0),
    netCredits: received - sent,
    subject: identifier,
    counterparty,
  }
}

// One state transition reaches us once per address or identity of ours it
// touched — funding an identity from our own addresses arrives from both sides —
// so the rows are folded into the wallet's own net rather than counted twice.
// Gas belongs to the transition, not to a side of it, and is never summed.
export function mergePlatformTransactions(rows: PlatformTransaction[]): PlatformTransaction[] {
  const byHash = new Map<string, PlatformTransaction>()

  for (const row of rows) {
    const seen = byHash.get(row.hash)
    if (seen == null) {
      byHash.set(row.hash, {...row})
      continue
    }

    seen.netCredits += row.netCredits
    seen.gasCredits = row.gasCredits > seen.gasCredits ? row.gasCredits : seen.gasCredits
    if (seen.subject !== row.subject) seen.subject = null
    // An address transition reports no counterparty at all, so its null means
    // unknown, not none.
    seen.counterparty ??= row.counterparty
    seen.status ??= row.status
    seen.error ??= row.error
    seen.blockHeight ??= row.blockHeight
  }

  return Array.from(byHash.values()).sort((a, b) => b.date.getTime() - a.date.getTime())
}
