import {Transaction, TransactionInput, TransactionOutput} from '../types/Transaction'
import {DashscanTransaction, DashscanVOut} from '../types/Dashscan'
import {DUFFS_PER_DASH} from '../constants/chain'

const duffs = (value: string | number | null): bigint => {
  if (value == null) return 0n
  return typeof value === 'number' ? BigInt(Math.round(value)) : BigInt(value)
}

// The p2p provider hands the renderer DASH decimal strings for input and output
// values, so this path has to produce the same shape. Going through Number
// would lose duffs on large outputs.
const dashString = (value: bigint): string => {
  const negative = value < 0n
  const abs = negative ? -value : value
  const fraction = (abs % DUFFS_PER_DASH).toString().padStart(8, '0')
  return `${negative ? '-' : ''}${abs / DUFFS_PER_DASH}.${fraction}`
}

const outputAddresses = (vout: DashscanVOut): string[] =>
  vout.addresses ?? (vout.address != null ? [vout.address] : [])

export const dashscanToWalletTransactions = (
  txs: DashscanTransaction[],
  walletId: string,
  ownedAddresses: string[],
): Transaction[] => {
  const owned = new Set(ownedAddresses)

  return txs.map(tx => {
    // An ASSET_UNLOCK has no vIn — its value comes from Platform, not from a
    // transparent input — and a QUORUM_COMMITMENT has neither side.
    const inputs = tx.vIn ?? []
    const outputs = tx.vOut ?? []

    const inAmount = inputs
      .filter(input => input.address != null && owned.has(input.address))
      .reduce((sum, input) => sum + duffs(input.amount), 0n)

    const walletOutputs = outputs.filter(output =>
      outputAddresses(output).some(address => owned.has(address))
    )
    const outAmount = walletOutputs.reduce((sum, output) => sum + duffs(output.value), 0n)

    const direction = inAmount > outAmount ? -1 : 1
    const transferAmount = direction === -1 ? inAmount - outAmount : outAmount - inAmount

    let address = ''
    if (direction === -1) {
      address = inputs.find(input => input.address != null && owned.has(input.address))?.address ?? ''
    } else {
      const [output] = walletOutputs
      address = output != null ? outputAddresses(output).find(a => owned.has(a)) ?? '' : ''
    }

    const vin: TransactionInput[] = inputs.map((input, index) => ({
      value: dashString(duffs(input.amount)),
      n: index,
      addr: input.address ?? '',
      prevTxId: input.prevTxHash ?? '',
      prevVout: input.vOutIndex ?? 0,
      sequence: input.sequence ?? 0,
    }))

    const vout: TransactionOutput[] = outputs.map((output, index) => ({
      value: dashString(duffs(output.value)),
      n: output.number ?? index,
      address: outputAddresses(output)[0] ?? '',
      spentTxId: output.spentTxId ?? '',
      spentIndex: output.spentIndex ?? 0,
      spentHeight: output.spentHeight ?? 0,
    }))

    return {
      address,
      direction,
      inAmount,
      outAmount,
      transferAmount,
      walletId,
      usdAmount: '0.0',
      status: tx.instantLock != null ? 'Locked' as const : 'Pending' as const,
      size: tx.size ?? 0,
      blockHeight: tx.blockHeight ?? 0,
      // The renderer sorts and groups on this field, so a mempool row dated to
      // the epoch sinks to the bottom of the history.
      date: tx.timestamp != null ? new Date(tx.timestamp) : new Date(),
      confirmations: tx.confirmations ?? 0,
      txid: tx.hash,
      vin,
      vout,
      instantLocked: tx.instantLock != null,
      chainlocked: tx.chainLocked === true,
      isLocal: null,
    }
  })
}