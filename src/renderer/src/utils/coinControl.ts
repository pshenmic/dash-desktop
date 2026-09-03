import type {
  CoreSpendSource,
  PlatformSpendSource,
  SelectableUtxo,
  ShieldedNoteInfo,
  ShieldedSpendSource,
} from '../api/types'
import { PLATFORM_INPUT_LIMIT } from '../constants/platform'
import { SHIELDED_NOTE_LIMIT } from '../constants/shielded'
import { SourceKind } from '../enums/SourceKind'
import { TransferOperation } from '../enums/TransferOperation'
import type { CoinControlInventory, CoinControlSelection } from '../types/CoinControl'

export const automaticCoinControl = (): CoinControlSelection => ({kind: 'automatic'})

export function coinControlSourceKind(operation: TransferOperation | null): SourceKind | null {
  if (
    operation === TransferOperation.CoreSend
    || operation === TransferOperation.AssetLockFunding
    || operation === TransferOperation.AssetLockShield
    || operation === TransferOperation.IdentityRegister
    || operation === TransferOperation.IdentityTopUpL1
  ) return SourceKind.Core

  if (
    operation === TransferOperation.AddressFundsTransfer
    || operation === TransferOperation.AddressWithdrawal
    || operation === TransferOperation.IdentityCreate
    || operation === TransferOperation.IdentityTopUp
  ) return SourceKind.PlatformAddress

  if (
    operation === TransferOperation.ShieldedTransfer
    || operation === TransferOperation.Unshield
    || operation === TransferOperation.ShieldedWithdrawal
  ) return SourceKind.Shielded

  return null
}

export function normalizeCoinControlSelection(
  selection: CoinControlSelection,
  operation: TransferOperation | null,
  inventory: CoinControlInventory,
): CoinControlSelection {
  const sourceKind = coinControlSourceKind(operation)
  if (selection.kind === 'automatic') return selection

  if (selection.kind === 'coreAddress') {
    return sourceKind === SourceKind.Core && inventory.coreAddresses.includes(selection.address)
      ? selection
      : automaticCoinControl()
  }
  if (selection.kind === 'coreOutpoints') {
    const available = new Set(inventory.coreOutpoints)
    return sourceKind === SourceKind.Core
      && selection.outpoints.length > 0
      && new Set(selection.outpoints).size === selection.outpoints.length
      && selection.outpoints.every(outpoint => available.has(outpoint))
      ? selection
      : automaticCoinControl()
  }
  if (selection.kind === 'platformAddress') {
    return sourceKind === SourceKind.PlatformAddress && inventory.platformBalances[selection.address] != null
      ? selection
      : automaticCoinControl()
  }
  if (selection.kind === 'platformInputs') {
    const addresses = selection.inputs.map(input => input.address)
    const valid = sourceKind === SourceKind.PlatformAddress
      && selection.inputs.length > 0
      && selection.inputs.length <= PLATFORM_INPUT_LIMIT
      && new Set(addresses).size === addresses.length
      && addresses.includes(selection.feeAddress)
      && selection.inputs.every(input => {
        const balance = inventory.platformBalances[input.address]
        return balance != null && input.credits > 0n && input.credits <= balance
      })
    return valid ? selection : automaticCoinControl()
  }
  if (selection.kind === 'shieldedAddress') {
    return sourceKind === SourceKind.Shielded && inventory.shieldedAddresses.includes(selection.address)
      ? selection
      : automaticCoinControl()
  }

  const available = new Set(inventory.shieldedNoteIndexes)
  return sourceKind === SourceKind.Shielded
    && selection.noteIndexes.length > 0
    && selection.noteIndexes.length <= SHIELDED_NOTE_LIMIT
    && new Set(selection.noteIndexes).size === selection.noteIndexes.length
    && selection.noteIndexes.every(index => available.has(index))
    ? selection
    : automaticCoinControl()
}

export function toCoreSpendSource(
  selection: CoinControlSelection,
  utxos: SelectableUtxo[],
): CoreSpendSource | undefined {
  if (selection.kind === 'coreAddress') return {kind: 'address', address: selection.address}
  if (selection.kind !== 'coreOutpoints') return undefined

  const selected = new Set(selection.outpoints)
  return {
    kind: 'outpoints',
    outpoints: utxos
      .filter(utxo => selected.has(outpointKey(utxo)))
      .map(utxo => ({txid: utxo.txid, vout: utxo.vout})),
  }
}

export function toPlatformSpendSource(selection: CoinControlSelection): PlatformSpendSource | null {
  if (selection.kind === 'platformAddress') return {kind: 'address', address: selection.address}
  if (selection.kind !== 'platformInputs') return null
  return {
    kind: 'inputs',
    inputs: selection.inputs,
    feeStrategy: [{kind: 'deductFromInput', address: selection.feeAddress}],
  }
}

export function toShieldedSpendSource(
  selection: CoinControlSelection,
  notes: ShieldedNoteInfo[],
): ShieldedSpendSource | undefined {
  if (selection.kind === 'shieldedNotes') {
    return {kind: 'notes', noteIndexes: selection.noteIndexes}
  }
  if (selection.kind !== 'shieldedAddress') return undefined
  return {
    kind: 'address',
    noteIndexes: notes.filter(note => note.address === selection.address).map(note => note.index),
  }
}

export const outpointKey = (outpoint: {txid: string; vout: number}): string =>
  `${outpoint.txid}:${outpoint.vout}`
