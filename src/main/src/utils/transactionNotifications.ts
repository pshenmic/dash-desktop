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
  const direction = transaction.direction === 1 ? 'in' : 'out'
  const paid = outputs
    .filter(output => output.isMine === (direction === 'in') && output.address != null)
    .map(output => output.address as string)

  return {
    chain: 'core',
    walletId: transaction.walletId,
    hash: transaction.txid,
    type: coreType(outputs),
    direction,
    amount: transaction.transferAmount,
    amountType: 'duffs',
    recipients: paid.length > 0 ? paid : null,
  }
}

export function platformTransactionMessage(transaction: PlatformTransaction): NewTransactionMessage {
  const direction = transaction.netCredits > 0n
    ? 'in'
    : transaction.netCredits < 0n ? 'out' : 'neutral'

  return {
    chain: 'platform',
    walletId: transaction.walletId,
    hash: transaction.hash,
    type: transaction.type,
    direction,
    amount: transaction.amountCredits,
    amountType: 'credits',
    recipients: transaction.recipient.length > 0
      ? transaction.recipient.map(end => end.source)
      : null,
  }
}
