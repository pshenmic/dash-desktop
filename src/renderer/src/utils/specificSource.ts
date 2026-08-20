import { SourceKind } from '../enums/SourceKind'
import { TransferOperation } from '../enums/TransferOperation'
import type {
  SpecificSourceKind,
  SpecificSourcePreferences,
} from '../types/SpecificSource'

export function initialSpecificSourcePreferences(): SpecificSourcePreferences {
  return {
    enabled: false,
    addresses: {
      [SourceKind.Core]: null,
      [SourceKind.Shielded]: null,
    },
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

export function updateSpecificSourceEnabled(
  preferences: SpecificSourcePreferences,
  enabled: boolean,
): SpecificSourcePreferences {
  return { ...preferences, enabled }
}

export function updateSpecificSourceAddress(
  preferences: SpecificSourcePreferences,
  kind: SpecificSourceKind,
  address: string,
): SpecificSourcePreferences {
  return {
    ...preferences,
    addresses: { ...preferences.addresses, [kind]: address },
  }
}
