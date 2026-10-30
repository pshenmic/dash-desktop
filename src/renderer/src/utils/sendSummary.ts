import { OPERATION_FUNDING_KINDS } from '../constants/sendPages'
import { POOL_IDENTITY_LABEL } from '../constants/sendSummary'
import { TX_SUMMARY_LABELS } from '../constants/txSummary'
import { TransferOperation } from '../enums/TransferOperation'
import type { SendSummaryInput, TxSummaryProps } from '../types/TxSummary'
import { operationInfo } from './transferMatrix'
import { assetLockSummaryCosts, shieldedSpendSummaryCosts } from './txSummaryCosts'
import {
  assetLockEndpoints,
  coreRecipientEndpoints,
  destinationEndpoint,
  recipientEndpoints,
  shieldedSpendEndpoints,
} from './txSummaryEndpoints'

export function sendSummary(input: SendSummaryInput): TxSummaryProps {
  const { operation, from, toDisplay, feeDuffs, feeCredits } = input

  if (operation === TransferOperation.CoreSend) {
    const amount = input.coreRecipients.reduce((sum, recipient) => sum + recipient.amountDuffs, 0n)
    return {
      unit: 'duffs',
      amount,
      from,
      to: coreRecipientEndpoints(input.coreRecipients),
      fees: [{ label: TX_SUMMARY_LABELS.networkFee, amount: feeDuffs, unit: 'duffs' }],
      total: feeDuffs === null ? null : amount + feeDuffs,
    }
  }

  const fundingKind = OPERATION_FUNDING_KINDS[operation]
  if (fundingKind != null) {
    return {
      unit: 'duffs',
      amount: input.amountDuffs,
      from,
      to: assetLockEndpoints(fundingKind, operation === TransferOperation.IdentityRegister ? '' : toDisplay),
      ...assetLockSummaryCosts(fundingKind, input.amountDuffs, feeDuffs, feeCredits),
    }
  }

  const spendKind = operationInfo(operation).spendKind
  if (spendKind != null) {
    return {
      unit: 'credits',
      amount: input.amountCredits,
      from,
      to: shieldedSpendEndpoints(
        spendKind,
        operation === TransferOperation.IdentityCreateFromShielded ? POOL_IDENTITY_LABEL : toDisplay,
        operation === TransferOperation.ShieldedTransfer ? input.platformRecipients : undefined,
      ),
      ...shieldedSpendSummaryCosts(spendKind, input.amountCredits, feeCredits),
    }
  }

  return {
    unit: 'credits',
    amount: input.amountCredits,
    from,
    to: operation === TransferOperation.AddressFundsTransfer
      ? recipientEndpoints(input.platformRecipients, input.feeOutputIndex)
      : [destinationEndpoint(input.destination, toDisplay)],
    fees: [{ label: TX_SUMMARY_LABELS.reservedFee, amount: feeCredits, unit: 'credits' }],
    total: feeCredits === null ? null : input.totalDebitCredits,
  }
}
