import { SourceKind } from '../enums/SourceKind'
import { DestinationKind } from '../enums/DestinationKind'
import { TransferOperation } from '../enums/TransferOperation'

const MATRIX: Record<SourceKind, Partial<Record<DestinationKind, TransferOperation>>> = {
  [SourceKind.Core]: {
    [DestinationKind.CoreAddress]: TransferOperation.CoreSend,
    [DestinationKind.PlatformAddress]: TransferOperation.AssetLockFunding,
    [DestinationKind.Identity]: TransferOperation.IdentityTopUpL1,
    [DestinationKind.NewIdentity]: TransferOperation.IdentityRegister,
    [DestinationKind.Shielded]: TransferOperation.AssetLockShield,
  },
  [SourceKind.PlatformAddress]: {
    [DestinationKind.CoreAddress]: TransferOperation.AddressWithdrawal,
    [DestinationKind.PlatformAddress]: TransferOperation.AddressFundsTransfer,
    [DestinationKind.Identity]: TransferOperation.IdentityTopUp,
    [DestinationKind.NewIdentity]: TransferOperation.IdentityCreate,
    [DestinationKind.Shielded]: TransferOperation.Shield,
  },
  [SourceKind.Identity]: {
    [DestinationKind.CoreAddress]: TransferOperation.IdentityWithdrawal,
    [DestinationKind.PlatformAddress]: TransferOperation.IdentityToAddress,
    [DestinationKind.Identity]: TransferOperation.IdentityToIdentity,
  },
  [SourceKind.Shielded]: {
    [DestinationKind.CoreAddress]: TransferOperation.ShieldedWithdrawal,
    [DestinationKind.PlatformAddress]: TransferOperation.Unshield,
    [DestinationKind.NewIdentity]: TransferOperation.IdentityCreateFromPool,
    [DestinationKind.Shielded]: TransferOperation.ShieldedTransfer,
  },
}

const COMBO_REASONS: Partial<Record<`${SourceKind}->${DestinationKind}`, string>> = {
  'identity->newIdentity': 'Send to a Platform address first, then create the identity from it.',
  'identity->shielded': 'Send to a Platform address first, then shield from it.',
  'shielded->identity': 'Unshield to a Platform address first, then top up the identity from it.',
}

export function resolveOperation(from: SourceKind, to: DestinationKind): TransferOperation | null {
  return MATRIX[from][to] ?? null
}

export function unsupportedReason(from: SourceKind, to: DestinationKind): string | null {
  if (MATRIX[from][to] != null) {
    return null
  }
  return COMBO_REASONS[`${from}->${to}`] ?? 'This combination is not supported.'
}

export interface OperationInfo {
  title: string
  submitLabel: string
  unit: 'credits' | 'dash'
  feeCredits: bigint | null
  minCredits: bigint | null
}

const OPERATION_INFO: Record<TransferOperation, OperationInfo> = {
  [TransferOperation.CoreSend]: {title: 'Send Dash', submitLabel: 'Send', unit: 'dash', feeCredits: null, minCredits: null},
  [TransferOperation.AssetLockFunding]: {title: 'Fund Platform address', submitLabel: 'Fund', unit: 'dash', feeCredits: null, minCredits: null},
  [TransferOperation.AssetLockShield]: {title: 'Shield from L1', submitLabel: 'Shield', unit: 'dash', feeCredits: null, minCredits: null},
  [TransferOperation.IdentityRegister]: {title: 'Register identity', submitLabel: 'Register', unit: 'dash', feeCredits: null, minCredits: null},
  [TransferOperation.IdentityTopUpL1]: {title: 'Top up identity from L1', submitLabel: 'Top up', unit: 'dash', feeCredits: null, minCredits: null},
  [TransferOperation.AddressFundsTransfer]: {title: 'Transfer credits', submitLabel: 'Send', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  [TransferOperation.IdentityTopUp]: {title: 'Top up identity', submitLabel: 'Top up', unit: 'credits', feeCredits: 1_000_000n, minCredits: 100_000n},
  [TransferOperation.IdentityCreate]: {title: 'Create identity', submitLabel: 'Create', unit: 'credits', feeCredits: 28_000_000n, minCredits: 500_000n},
  [TransferOperation.AddressWithdrawal]: {title: 'Withdraw to Core', submitLabel: 'Withdraw', unit: 'credits', feeCredits: 400_000_000n, minCredits: 100_000n},
  [TransferOperation.Shield]: {title: 'Shield credits', submitLabel: 'Shield', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  [TransferOperation.IdentityToAddress]: {title: 'Send from identity', submitLabel: 'Send', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  [TransferOperation.IdentityToIdentity]: {title: 'Send to identity', submitLabel: 'Send', unit: 'credits', feeCredits: 1_000_000n, minCredits: 100_000n},
  [TransferOperation.IdentityWithdrawal]: {title: 'Withdraw from identity', submitLabel: 'Withdraw', unit: 'credits', feeCredits: 400_000_000n, minCredits: 100_000n},
  [TransferOperation.ShieldedTransfer]: {title: 'Send privately', submitLabel: 'Send', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  [TransferOperation.Unshield]: {title: 'Unshield', submitLabel: 'Unshield', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  [TransferOperation.ShieldedWithdrawal]: {title: 'Withdraw to L1', submitLabel: 'Withdraw', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  [TransferOperation.IdentityCreateFromPool]: {title: 'Create identity from pool', submitLabel: 'Create', unit: 'credits', feeCredits: 0n, minCredits: 10_000_000_000n},
}

export function operationInfo(operation: TransferOperation): OperationInfo {
  return OPERATION_INFO[operation]
}

// The protocol only lets identities exit the shielded pool at fixed
// denominations (uniform amounts keep pool spends unlinkable).
export const POOL_IDENTITY_DENOMINATIONS: readonly bigint[] = [
  10_000_000_000n,
  30_000_000_000n,
  50_000_000_000n,
  100_000_000_000n,
]

export function isPoolIdentityDenomination(amountCredits: bigint): boolean {
  return POOL_IDENTITY_DENOMINATIONS.includes(amountCredits)
}

export function isLikelyIdentityId(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{42,44}$/.test(value.trim())
}

export const SOURCE_KINDS: Array<{kind: SourceKind; label: string}> = [
  {kind: SourceKind.Core, label: 'Dash Core (L1)'},
  {kind: SourceKind.PlatformAddress, label: 'Platform address'},
  {kind: SourceKind.Identity, label: 'Identity'},
  {kind: SourceKind.Shielded, label: 'Shielded balance'},
]

export const DESTINATION_KINDS: Array<{kind: DestinationKind; label: string}> = [
  {kind: DestinationKind.CoreAddress, label: 'Dash address (L1)'},
  {kind: DestinationKind.PlatformAddress, label: 'Platform address'},
  {kind: DestinationKind.Identity, label: 'Identity'},
  {kind: DestinationKind.NewIdentity, label: 'New identity'},
  {kind: DestinationKind.Shielded, label: 'Shielded address'},
]
