import { SourceKind } from '../enums/SourceKind'
import { DestinationKind } from '../enums/DestinationKind'
import { TransferOperation } from '../enums/TransferOperation'
import { ShieldedSpendKind } from '../enums/ShieldedSpendKind'

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

interface OperationInfo {
  title: string
  submitLabel: string
  minCredits: bigint | null
  spendKind: ShieldedSpendKind | null
}

const OPERATION_INFO: Record<TransferOperation, OperationInfo> = {
  [TransferOperation.CoreSend]: {title: 'Send Dash', submitLabel: 'Send', minCredits: null, spendKind: null},
  [TransferOperation.AssetLockFunding]: {title: 'Fund Platform address', submitLabel: 'Fund', minCredits: null, spendKind: null},
  [TransferOperation.AssetLockShield]: {title: 'Shield from L1', submitLabel: 'Shield', minCredits: null, spendKind: null},
  [TransferOperation.IdentityRegister]: {title: 'Register identity', submitLabel: 'Register', minCredits: null, spendKind: null},
  [TransferOperation.IdentityTopUpL1]: {title: 'Top up identity from L1', submitLabel: 'Top up', minCredits: null, spendKind: null},
  [TransferOperation.AddressFundsTransfer]: {title: 'Transfer credits', submitLabel: 'Send', minCredits: 500_000n, spendKind: null},
  [TransferOperation.IdentityTopUp]: {title: 'Top up identity', submitLabel: 'Top up', minCredits: 100_000n, spendKind: null},
  [TransferOperation.IdentityCreate]: {title: 'Create identity', submitLabel: 'Create', minCredits: 500_000n, spendKind: null},
  [TransferOperation.AddressWithdrawal]: {title: 'Withdraw to Core', submitLabel: 'Withdraw', minCredits: 100_000n, spendKind: null},
  [TransferOperation.Shield]: {title: 'Shield credits', submitLabel: 'Shield', minCredits: 500_000n, spendKind: null},
  [TransferOperation.IdentityToAddress]: {title: 'Send from identity', submitLabel: 'Send', minCredits: 500_000n, spendKind: null},
  [TransferOperation.IdentityToIdentity]: {title: 'Send to identity', submitLabel: 'Send', minCredits: 100_000n, spendKind: null},
  [TransferOperation.IdentityWithdrawal]: {title: 'Withdraw from identity', submitLabel: 'Withdraw', minCredits: 100_000n, spendKind: null},
  [TransferOperation.ShieldedTransfer]: {title: 'Shielded send', submitLabel: 'Send', minCredits: 500_000n, spendKind: ShieldedSpendKind.Transfer},
  [TransferOperation.Unshield]: {title: 'Unshield', submitLabel: 'Unshield', minCredits: 500_000n, spendKind: ShieldedSpendKind.Unshield},
  [TransferOperation.ShieldedWithdrawal]: {title: 'Withdraw to L1', submitLabel: 'Withdraw', minCredits: 500_000n, spendKind: ShieldedSpendKind.Withdrawal},
  [TransferOperation.IdentityCreateFromPool]: {title: 'Create identity from pool', submitLabel: 'Create', minCredits: 10_000_000_000n, spendKind: ShieldedSpendKind.IdentityCreate},
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
