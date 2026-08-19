import { SourceKind } from '../enums/SourceKind'
import { TransferOperation } from '../enums/TransferOperation'
import type {
  SpecificSourceKind,
  SpecificSourcePreference,
  SpecificSourcePreferences,
} from '../types/SpecificSource'

export function initialSpecificSourcePreferences(): SpecificSourcePreferences {
  return {
    [SourceKind.Core]: { enabled: false, address: null },
    [SourceKind.Shielded]: { enabled: false, address: null },
  }
}

export function specificSourceKindForOperation(operation: TransferOperation | null): SpecificSourceKind | null {
  if (operation === TransferOperation.CoreSend) return SourceKind.Core
  if (
    operation === TransferOperation.ShieldedTransfer
    || operation === TransferOperation.Unshield
    || operation === TransferOperation.ShieldedWithdrawal
  ) {
    return SourceKind.Shielded
  }
  return null
}

export function updateSpecificSourcePreference(
  preferences: SpecificSourcePreferences,
  kind: SpecificSourceKind,
  update: Partial<SpecificSourcePreference>,
): SpecificSourcePreferences {
  return {
    ...preferences,
    [kind]: { ...preferences[kind], ...update },
  }
}
