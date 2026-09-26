import {AppliedTxOutput} from '../../p2p/types/walletSync'
import {NewTransactionMessage} from '../types/Message'
import {PlatformTransaction} from '../types/PlatformTransaction'
import {Transaction} from '../types/Transaction'

// Core names no type on the wire; this is the split the tx list filters on.
const coreType = (outputs: AppliedTxOutput[]): string =>
  outputs.some(output => output.address == null) ? 'assetLock' : 'transfer'

// The row's `address` is our own end in both directions, so who was paid can
// only come off the outputs.
export function coreTransactionMessage(transaction: Transaction, outputs: AppliedTxOutput[]): NewTransactionMessage {
  const netAmount = transaction.outAmount - transaction.inAmount
  const incoming = netAmount > 0n
  const paid = outputs
    .filter(output => output.isMine === incoming && output.address != null)
    .map(output => output.address as string)

  return {
    chain: 'core',
    walletId: transaction.walletId,
    hash: transaction.txid,
    type: coreType(outputs),
    netAmount,
    amount: transaction.transferAmount,
    recipients: paid.length > 0 ? paid : null,
    assetLockTxid: null,
  }
}

export function platformTransactionMessage(
  transaction: PlatformTransaction,
  assetLockTxid: string | null,
): NewTransactionMessage {
  return {
    chain: 'platform',
    walletId: transaction.walletId,
    hash: transaction.hash,
    type: transaction.type,
    netAmount: transaction.netCredits,
    amount: transaction.amountCredits,
    recipients: transaction.recipient.length > 0
      ? transaction.recipient.map(end => end.source)
      : null,
    assetLockTxid,
  }
}
