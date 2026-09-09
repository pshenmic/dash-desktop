import type {
  CoreSpendSource,
  PlatformSpendSource,
  SelectableUtxo,
  ShieldedNoteInfo,
  ShieldedSpendSource,
} from '../api/types'
import { PLATFORM_INPUT_LIMIT } from '../constants/platform'
import { INPUT_ITEM_LABELS } from '../constants/coinControl'
import { SHIELDED_NOTE_LIMIT } from '../constants/shielded'
import { SourceKind } from '../enums/SourceKind'
import { TransferOperation } from '../enums/TransferOperation'
import type { CoinControlFunds, CoinControlInventory, CoinControlSelection, CoinControlTotals } from '../types/CoinControl'
import { creditsToDuffs, davToDashCompact, duffsToCredits } from './balance'

export const automaticCoinControl = (): CoinControlSelection => ({kind: 'automatic'})

export function buildCoinControlInventory(funds: CoinControlFunds): CoinControlInventory {
  const notes = funds.shieldedNotes.filter(note => !note.spent)
  return {
    coreAddresses: funds.coreAddresses.map(address => address.address),
    coreOutpoints: funds.utxos.map(outpointKey),
    platformBalances: Object.fromEntries(funds.platformAddresses.map(address => [address.platformAddress, address.balanceCredits])),
    shieldedAddresses: [...new Set(notes.map(note => note.address))],
    shieldedNoteIndexes: notes.map(note => note.index),
  }
}

export function coinControlSelectionTotals(selection: CoinControlSelection, funds: CoinControlFunds): CoinControlTotals {
  let count = 0
  let duffs = 0n
  let credits = 0n
  switch (selection.kind) {
    case 'coreAddress':
      count = 1
      duffs = funds.coreAddresses.find(address => address.address === selection.address)?.balance ?? 0n
      return {count, duffs, credits: duffsToCredits(duffs)}
    case 'coreOutpoints': {
      count = selection.outpoints.length
      const selected = new Set(selection.outpoints)
      duffs = funds.utxos.filter(utxo => selected.has(outpointKey(utxo))).reduce((sum, utxo) => sum + utxo.satoshis, 0n)
      return {count, duffs, credits: duffsToCredits(duffs)}
    }
    case 'platformAddress':
      count = 1
      credits = funds.platformAddresses.find(address => address.platformAddress === selection.address)?.balanceCredits ?? 0n
      break
    case 'platformInputs':
      count = selection.inputs.length
      credits = selection.inputs.reduce((sum, input) => sum + input.credits, 0n)
      break
    case 'shieldedAddress':
      count = 1
      credits = funds.shieldedNotes.filter(note => !note.spent && note.address === selection.address).reduce((sum, note) => sum + note.amount, 0n)
      break
    case 'shieldedNotes': {
      count = selection.noteIndexes.length
      const selected = new Set(selection.noteIndexes)
      credits = funds.shieldedNotes.filter(note => !note.spent && selected.has(note.index)).reduce((sum, note) => sum + note.amount, 0n)
      break
    }
  }
  return {count, duffs: creditsToDuffs(credits), credits}
}

export function coinControlSelectionSummary(
  selection: CoinControlSelection,
  totals: CoinControlTotals,
  includeAddressBalance = false,
): string {
  let label: string
  let addressSelection = false
  switch (selection.kind) {
    case 'automatic':
      return 'Automatic'
    case 'coreAddress':
      label = 'One Core address'
      addressSelection = true
      break
    case 'platformAddress':
      label = 'One Platform address'
      addressSelection = true
      break
    case 'shieldedAddress':
      label = 'One shielded address'
      addressSelection = true
      break
    case 'coreOutpoints':
      label = `${totals.count} ${coinControlInputLabel(SourceKind.Core, totals.count)}`
      break
    case 'platformInputs':
      label = `${totals.count} ${coinControlInputLabel(SourceKind.PlatformAddress, totals.count)}`
      break
    case 'shieldedNotes':
      label = `${totals.count} ${coinControlInputLabel(SourceKind.Shielded, totals.count)}`
      break
  }
  if (addressSelection && !includeAddressBalance) return label
  return `${label} · ${davToDashCompact(totals.duffs)} Dash`
}

export function coinControlInputLabel(sourceKind: SourceKind | null, count: number): string {
  const labels = INPUT_ITEM_LABELS[sourceKind ?? SourceKind.PlatformAddress]
  return count === 1 ? labels.singular : labels.plural
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

export function coreSpendSourceKey(source: CoreSpendSource | null): string {
  if (source == null) return ''
  if (source.kind === 'address') return source.address
  return source.outpoints.map(outpointKey).join(',')
}

export function platformSpendSourceKey(source: PlatformSpendSource | null): string {
  if (source == null) return ''
  if (source.kind === 'address') return source.address
  const inputs = source.inputs.map(input => `${input.address}:${input.credits}`).join(',')
  const feeStrategy = source.feeStrategy.map(step => {
    if (step.kind === 'deductFromInput') return step.address
    return step.index
  }).join(',')
  return `${inputs}|${feeStrategy}`
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
