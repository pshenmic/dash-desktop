import {AppliedTxOutput} from '../../p2p/types/walletSync'
import {NewTransactionMessage} from '../types/Message'
import {PlatformTransaction} from '../types/PlatformTransaction'
import {Transaction} from '../types/Transaction'

// Core carries no transaction type on the wire; this is the same split the
// transaction list filters on — an output no address can be derived from is the
// asset lock's.
const coreType = (outputs: AppliedTxOutput[]): string =>
  outputs.some(output => output.address == null) ? 'assetLock' : 'transfer'

// Outputs are the only place ownership is recorded per end, which is why they
// are read here rather than off the transaction: the row's `address` is this
// wallet's own end in both directions, never who was paid.
export function coreTransactionMessage(transaction: Transaction, outputs: AppliedTxOutput[]): NewTransactionMessage {
  // The two totals the row already holds are what direction is derived from
  // upstream, so their difference is the net without re-deriving anything.
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
  }
}

export function platformTransactionMessage(transaction: PlatformTransaction): NewTransactionMessage {
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
  }
}
