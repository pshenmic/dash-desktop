import { COIN_CONTROL_AMOUNT_SORTS, COIN_CONTROL_SORT_OPTIONS, FEE_PAYER_KEY_STEPS } from '../constants/coinControl'
import { CoinControlSort } from '../enums/CoinControl'
import { SourceKind } from '../enums/SourceKind'
import type { CoinControlFunds, CoinControlSelection } from '../types/CoinControl'
import type { SegmentOption } from '../types/SegmentedControl'
import { compareBigIntsDescending } from './balance'

export function hideUnselectedDust<T>(
  items: T[],
  enabled: boolean,
  isDust: (item: T) => boolean,
  isSelected: (item: T) => boolean,
): T[] {
  if (!enabled) return items
  return items.filter(item => !isDust(item) || isSelected(item))
}

export function coinControlSelectionKeys(selection: CoinControlSelection): string[] {
  switch (selection.kind) {
    case 'coreOutpoints':
      return selection.outpoints
    case 'platformInputs':
      return selection.inputs.map(input => input.address)
    case 'shieldedNotes':
      return selection.noteIndexes.map(String)
    default:
      return []
  }
}

export function dustFilterKeepKeys(selections: CoinControlSelection[], touchedKeys: string[]): Set<string> {
  return new Set([...selections.flatMap(coinControlSelectionKeys), ...touchedKeys])
}

export function steppedFeePayer(addresses: string[], current: string, key: string): string | null {
  const step = FEE_PAYER_KEY_STEPS[key]
  const index = addresses.indexOf(current)
  if (step == null || index < 0) return null
  return addresses[(index + step + addresses.length) % addresses.length]
}

export function coinControlSourceAddresses(sourceKind: SourceKind | null, funds: CoinControlFunds): string[] {
  switch (sourceKind) {
    case SourceKind.Core: {
      const utxoAddresses = funds.utxos.map(utxo => utxo.address)
      const addresses = utxoAddresses.length > 0 ? utxoAddresses : funds.coreAddresses.map(entry => entry.address)
      return [...new Set(addresses)]
    }
    case SourceKind.PlatformAddress:
      return [...new Set(funds.platformAddresses.map(entry => entry.platformAddress))]
    case SourceKind.Shielded:
      return [...new Set(funds.shieldedNotes.map(note => note.address))]
    default:
      return []
  }
}

export function coinControlSortOptions(sourceKind: SourceKind | null): SegmentOption<CoinControlSort>[] {
  if (sourceKind !== SourceKind.PlatformAddress) return COIN_CONTROL_SORT_OPTIONS
  return COIN_CONTROL_SORT_OPTIONS.filter(option => COIN_CONTROL_AMOUNT_SORTS.includes(option.value))
}

export function sortCoinControlInputs<T>(
  items: T[],
  sort: CoinControlSort,
  amount: (item: T) => bigint,
  recency?: (item: T) => number,
): T[] {
  return [...items].sort((a, b) => {
    switch (sort) {
      case CoinControlSort.LargestFirst:
        return compareBigIntsDescending(amount(a), amount(b))
      case CoinControlSort.SmallestFirst:
        return compareBigIntsDescending(amount(b), amount(a))
      case CoinControlSort.Newest:
        return recency ? recency(b) - recency(a) : 0
      case CoinControlSort.Oldest:
        return recency ? recency(a) - recency(b) : 0
    }
  })
}
