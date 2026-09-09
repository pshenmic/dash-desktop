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

export function parsePlatformInputCredits(value: string): bigint | null {
  if (/[^0-9]/.test(value)) return null
  return BigInt(value || '0')
}

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
): CoinControlSelection {
  const sourceKind = coinControlSourceKind(operation)
  switch (selection.kind) {
    case 'coreAddress':
    case 'coreOutpoints':
      if (sourceKind === SourceKind.Core) return selection
      break
    case 'platformAddress':
    case 'platformInputs':
      if (sourceKind === SourceKind.PlatformAddress) return selection
      break
    case 'shieldedAddress':
    case 'shieldedNotes':
      if (sourceKind === SourceKind.Shielded) return selection
      break
    case 'automatic':
      return selection
  }
  return automaticCoinControl()
}

export function isCoinControlSelectionValid(
  selection: CoinControlSelection,
  inventory: CoinControlInventory,
): boolean {
  if (selection.kind === 'automatic') return true

  if (selection.kind === 'coreAddress') {
    return inventory.coreAddresses.includes(selection.address)
  }
  if (selection.kind === 'coreOutpoints') {
    const available = new Set(inventory.coreOutpoints)
    return selection.outpoints.length > 0
      && new Set(selection.outpoints).size === selection.outpoints.length
      && selection.outpoints.every(outpoint => available.has(outpoint))
  }
  if (selection.kind === 'platformAddress') {
    return inventory.platformBalances[selection.address] != null
  }
  if (selection.kind === 'platformInputs') {
    const addresses = selection.inputs.map(input => input.address)
    return selection.inputs.length > 0
      && selection.inputs.length <= PLATFORM_INPUT_LIMIT
      && new Set(addresses).size === addresses.length
      && addresses.includes(selection.feeAddress)
      && selection.inputs.every(input => {
        const balance = inventory.platformBalances[input.address]
        return balance != null && input.credits > 0n && input.credits <= balance
      })
  }
  if (selection.kind === 'shieldedAddress') {
    return inventory.shieldedAddresses.includes(selection.address)
  }

  const available = new Set(inventory.shieldedNoteIndexes)
  return selection.noteIndexes.length > 0
    && selection.noteIndexes.length <= SHIELDED_NOTE_LIMIT
    && new Set(selection.noteIndexes).size === selection.noteIndexes.length
    && selection.noteIndexes.every(index => available.has(index))
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
