import {PlatformExplorerAddressTransition, PlatformExplorerTransfer} from '../types/PlatformExplorer'
import {PlatformTransaction, PlatformTxStatus} from '../types/PlatformTransaction'

// A transition is only listed once a block carries it, so a missing timestamp
// means the block row is missing rather than that the transition is pending.
const transitionDate = (value: string | null): Date => value != null ? new Date(value) : new Date(0)

const transitionStatus = (value: string | null): PlatformTxStatus | null =>
  value === 'SUCCESS' || value === 'FAIL' ? value : null

export function addressTransitionToPlatformTransaction(
  row: PlatformExplorerAddressTransition,
  walletId: string,
): PlatformTransaction {
  const net = row.amount == null ? 0n : BigInt(row.amount)
  const incoming = row.incoming ?? net > 0n

  return {
    walletId,
    hash: row.hash,
    type: row.type,
    date: transitionDate(row.timestamp),
    blockHeight: row.blockHeight,
    status: transitionStatus(row.status),
    error: row.error,
    gasCredits: BigInt(row.gasUsed ?? 0),
    netCredits: net,
    amountCredits: net < 0n ? -net : net,
    // bech32m: the form platform_addresses holds. The base58 field is the same
    // key in an encoding nothing in this wallet is stored under.
    sender: incoming ? null : row.bech32mAddress,
    recipient: incoming ? row.bech32mAddress : null,
  }
}

export function transferToPlatformTransaction(
  row: PlatformExplorerTransfer,
  identifier: string,
  walletId: string,
): PlatformTransaction {
  const amount = row.amount == null ? 0n : BigInt(row.amount)
  const received = row.recipient === identifier ? amount : 0n
  const sent = row.sender === identifier ? amount : 0n

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
    amountCredits: amount,
    sender: row.sender,
    recipient: row.recipient,
  }
}

// One state transition reaches us once per address or identity of ours it
// touched — a move between two of ours arrives from both sides — so the rows
// are folded into the wallet's own net rather than counted twice. Gas and the
// amount belong to the transition, not to a side of it, and are never summed:
// the amount is the largest side, which a net of nothing would otherwise hide.
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
    seen.amountCredits = row.amountCredits > seen.amountCredits ? row.amountCredits : seen.amountCredits
    seen.sender ??= row.sender
    seen.recipient ??= row.recipient
    seen.status ??= row.status
    seen.error ??= row.error
    seen.blockHeight ??= row.blockHeight
  }

  return Array.from(byHash.values()).sort((a, b) => b.date.getTime() - a.date.getTime())
}
