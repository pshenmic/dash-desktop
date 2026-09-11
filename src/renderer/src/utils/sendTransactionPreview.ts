import type { PreviewEntry, PreviewParams } from '../api/types'
import { SEND_PREVIEW_INITIAL_STATE } from '../constants/sendTransactionPreview'
import { SourceKind } from '../enums/SourceKind'
import { TransferOperation } from '../enums/TransferOperation'
import type { SendPreviewAction, SendPreviewFee, SendPreviewKeyParams, SendPreviewMappingParams, SendPreviewParams, SendPreviewRow, SendPreviewState, SendTransactionPreviewData } from '../types/SendTransactionPreview'
import { duffsToCredits } from './balance'
import { coinControlSourceKind } from './coinControl'
import { operationInfo } from './transferMatrix'

export function sendPreviewParams({operation, recipients, coreSource, platformSource, shieldedSource, identityId, fromAddress, changeTo}: SendPreviewParams): PreviewParams {
  const isCoreOperation = coinControlSourceKind(operation) === SourceKind.Core
  const amountDuffs = recipients.reduce((sum, recipient) => sum + recipient.amountDuffs, 0n)
  const createsIdentity = operation === TransferOperation.IdentityRegister || operation === TransferOperation.IdentityCreate
    || operation === TransferOperation.IdentityCreateFromShielded
  return {
    recipients: recipients.map(recipient => ({
      address: createsIdentity ? '' : recipient.address,
      amount: isCoreOperation ? recipient.amountDuffs : duffsToCredits(recipient.amountDuffs),
    })),
    amountCredits: isCoreOperation ? 0n : duffsToCredits(amountDuffs),
    amountDuffs: isCoreOperation ? amountDuffs : null,
    coreSource: isCoreOperation ? coreSource : undefined,
    platformSource: coinControlSourceKind(operation) === SourceKind.PlatformAddress ? platformSource : undefined,
    shieldedSource: coinControlSourceKind(operation) === SourceKind.Shielded ? shieldedSource : undefined,
    identityId: operation === TransferOperation.IdentityToAddress || operation === TransferOperation.IdentityToIdentity
      || operation === TransferOperation.IdentityWithdrawal ? identityId : undefined,
    fromAddress: operation === TransferOperation.Shield ? fromAddress : undefined,
    changeTo: operation === TransferOperation.CoreSend ? changeTo : undefined,
  }
}

export function sendPreviewRequestKey(params: SendPreviewKeyParams): string {
  return JSON.stringify(params, (_key, value) => typeof value === 'bigint' ? `${value}n` : value)
}

export function previewEntryCredits(entry: PreviewEntry): bigint {
  return entry.unit === 'duffs' ? duffsToCredits(entry.amount) : entry.amount
}

export function sendPreviewRow(entry: PreviewEntry): SendPreviewRow {
  let addressLabel = entry.address
  if (!addressLabel) {
    if (entry.role === 'change') addressLabel = 'Your shielded balance'
    else if (entry.role === 'recipient') addressLabel = 'New Platform identity'
    else addressLabel = 'Address unavailable'
  }
  return {
    ...entry,
    addressLabel,
  }
}

export function mapSendTransactionPreview({preview, operation, from}: SendPreviewMappingParams): SendTransactionPreviewData {
  const isCoreOperation = coinControlSourceKind(operation) === SourceKind.Core
  const assetLock = preview.outputs.some(output => output.role === 'credit')
  const recipients = preview.outputs.filter(output => output.role === 'recipient')
  const amountCredits = recipients.reduce((sum, output) => sum + previewEntryCredits(output), 0n)
  const inputCredits = preview.inputs.reduce((sum, input) => sum + previewEntryCredits(input), 0n)
  const changeCredits = preview.outputs.filter(output => output.role === 'change')
    .reduce((sum, output) => sum + previewEntryCredits(output), 0n)
  const fees: SendPreviewFee[] = []
  if (preview.feeDuffs != null) fees.push({label: assetLock ? 'L1 network fee' : 'Network fee', amount: preview.feeDuffs, unit: 'duffs'})
  if (preview.feeCredits != null) fees.push({label: assetLock ? 'Platform network fee' : 'Network fee', amount: preview.feeCredits, unit: 'credits'})
  return {
    title: operationInfo(operation).title,
    from,
    isCoreOperation,
    amountCredits,
    totalDebitCredits: inputCredits - changeCredits,
    feeDuffs: preview.feeDuffs,
    feeCredits: preview.feeCredits,
    fees,
    inputs: preview.inputs.map(sendPreviewRow),
    outputGroups: assetLock ? [
      {title: 'L1 asset lock', rows: preview.outputs.filter(output => output.role !== 'recipient').map(sendPreviewRow)},
      {title: 'Platform recipients', rows: recipients.map(sendPreviewRow)},
    ] : [{title: null, rows: preview.outputs.map(sendPreviewRow)}],
    unsignedHex: preview.unsignedHex,
    unsignedLabel: assetLock ? 'Unsigned L1 asset lock' : isCoreOperation ? 'Unsigned transaction' : 'Unsigned state transition',
  }
}

export function sendPreviewReducer(state: SendPreviewState, action: SendPreviewAction): SendPreviewState {
  if (action.type === 'reset') return SEND_PREVIEW_INITIAL_STATE
  if (action.type === 'start') return {requestId: action.requestId, loading: true, error: null, data: null}
  if (action.requestId !== state.requestId) return state
  if (action.type === 'loaded') return {...state, loading: false, error: null, data: action.data}
  return {...state, loading: false, error: action.error, data: null}
}
