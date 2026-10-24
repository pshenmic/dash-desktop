import { FEE_PAYER_KEY_STEPS } from '../constants/coinControl'
import { SourceKind } from '../enums/SourceKind'
import type { CoinControlFunds, CoinControlSelection } from '../types/CoinControl'

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
