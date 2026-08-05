import { TransferOperation } from '../enums/TransferOperation'
import { CoreFeeShape } from '../enums/CoreFeeShape'
import { FeeEndpoint } from '../enums/FeeEndpoint'
import {
  CoreFeeQuery,
  OperationFeeQuery,
  PlatformAddressDto,
  TransitionFeeInput,
  TransitionFeeParams,
  TransitionFeeQuery,
} from '../api/types'
import {
  FEE_QUOTE_DERIVATION_INDEX,
  FEE_QUOTE_INPUT_COUNT,
  FEE_QUOTE_SHIELD_NOTE_COUNT,
} from '../constants/transitionFee'
import { operationInfo } from './transferMatrix'

export function feeQueryKey(query: TransitionFeeQuery | CoreFeeQuery): string {
  return JSON.stringify(query, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
}

export function coreFeeQueryFor(
  shape: CoreFeeShape,
  amountDuffs: bigint,
  toAddress: string | null,
  fromAddress: string | null,
): CoreFeeQuery {
  return shape === CoreFeeShape.Send
    ? { shape, amountDuffs, toAddress, fromAddress }
    : { shape, amountDuffs }
}

export function feeQueryFor(
  operation: TransferOperation | null,
  params: TransitionFeeParams,
): OperationFeeQuery | null {
  const { destinationValid, recipient, amountDuffs, fromAddress } = params
  if (operation == null || !destinationValid) return null

  const shape = operationInfo(operation).coreFeeShape
  if (shape !== null) {
    if (amountDuffs <= 0n) return null
    return { endpoint: FeeEndpoint.Core, query: coreFeeQueryFor(shape, amountDuffs, recipient, fromAddress) }
  }

  const query = transitionQueryFor(operation, params)
  return query === null ? null : { endpoint: FeeEndpoint.Transition, query }
}

function transitionQueryFor(
  operation: TransferOperation,
  params: TransitionFeeParams,
): TransitionFeeQuery | null {
  const { recipient, amountCredits, source, identityId } = params

  const hasAmount = amountCredits > 0n

  switch (operation) {
    case TransferOperation.AddressFundsTransfer:
      return { kind: 'addressTransfer', inputCount: FEE_QUOTE_INPUT_COUNT, recipients: [recipient] }

    case TransferOperation.AddressWithdrawal:
      return { kind: 'addressWithdrawal', inputCount: FEE_QUOTE_INPUT_COUNT, hasChange: true }

    case TransferOperation.Shield:
      return { kind: 'shield', noteCount: FEE_QUOTE_SHIELD_NOTE_COUNT, inputCount: FEE_QUOTE_INPUT_COUNT,
               fromAssetLock: false, surplusAddress: null }

    case TransferOperation.IdentityTopUp:
      return source == null || !hasAmount
        ? null
        : {
            kind: 'identityTopUpFromAddresses',
            identityId: recipient,
            inputs: [toInput(source, amountCredits)],
          }

    case TransferOperation.IdentityCreate:
      return source == null || !hasAmount
        ? null
        : { kind: 'identityCreateFromAddresses', inputs: [toInput(source, amountCredits)] }

    case TransferOperation.IdentityToAddress:
      return identityId == null || !hasAmount
        ? null
        : {
            kind: 'identityCreditsToAddresses',
            identityId,
            recipients: [{ address: recipient, amountCredits }],
          }

    case TransferOperation.IdentityToIdentity:
      return identityId == null || !hasAmount
        ? null
        : { kind: 'identityCreditTransfer', identityId, recipientId: recipient, amountCredits }

    case TransferOperation.IdentityWithdrawal:
      return identityId == null || !hasAmount
        ? null
        : { kind: 'identityWithdrawal', identityId, amountCredits, coreAddress: recipient }

    case TransferOperation.CoreSend:
    case TransferOperation.AssetLockFunding:
    case TransferOperation.AssetLockShield:
    case TransferOperation.IdentityRegister:
    case TransferOperation.IdentityTopUpL1:
    case TransferOperation.ShieldedTransfer:
    case TransferOperation.Unshield:
    case TransferOperation.ShieldedWithdrawal:
    case TransferOperation.IdentityCreateFromPool:
      return null
  }
}

function toInput(source: PlatformAddressDto, amountCredits: bigint): TransitionFeeInput {
  return {
    platformAddress: source.platformAddress,
    index: FEE_QUOTE_DERIVATION_INDEX,
    nonce: source.nonce,
    credits: amountCredits,
  }
}
