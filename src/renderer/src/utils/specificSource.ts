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
      [SourceKind.PlatformAddress]: null,
      [SourceKind.Shielded]: null,
    },
  }
}

export function specificSourceKindForOperation(operation: TransferOperation | null): SpecificSourceKind | null {
  // Every operation funded by L1 coins, not just the plain send: an asset lock
  // binds the coins it spends to its L2 destination for good.
  if (
    operation === TransferOperation.CoreSend
    || operation === TransferOperation.AssetLockFunding
    || operation === TransferOperation.AssetLockShield
    || operation === TransferOperation.IdentityRegister
    || operation === TransferOperation.IdentityTopUpL1
  ) {
    return SourceKind.Core
  }
  // The three transitions whose fee scales with the inputs they take, which are
  // the only ones a pick can name.
  if (
    operation === TransferOperation.AddressFundsTransfer
    || operation === TransferOperation.AddressWithdrawal
    || operation === TransferOperation.IdentityCreate
    || operation === TransferOperation.IdentityTopUp
  ) {
    return SourceKind.PlatformAddress
  }
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
