export type SourceKind = 'core' | 'platformAddress' | 'identity' | 'shielded'
export type DestinationKind = 'coreAddress' | 'platformAddress' | 'identity' | 'newIdentity' | 'shielded'

export type TransferOperation =
  | 'coreSend'
  | 'assetLockFunding'
  | 'assetLockShield'
  | 'identityRegister'
  | 'identityTopUpL1'
  | 'addressFundsTransfer'
  | 'identityTopUp'
  | 'identityCreate'
  | 'addressWithdrawal'
  | 'shield'
  | 'identityToAddress'
  | 'identityToIdentity'
  | 'identityWithdrawal'
  | 'shieldedTransfer'
  | 'unshield'
  | 'shieldedWithdrawal'
  | 'identityCreateFromPool'

const MATRIX: Record<SourceKind, Partial<Record<DestinationKind, TransferOperation>>> = {
  core: {
    coreAddress: 'coreSend',
    platformAddress: 'assetLockFunding',
    identity: 'identityTopUpL1',
    newIdentity: 'identityRegister',
    shielded: 'assetLockShield',
  },
  platformAddress: {
    coreAddress: 'addressWithdrawal',
    platformAddress: 'addressFundsTransfer',
    identity: 'identityTopUp',
    newIdentity: 'identityCreate',
    shielded: 'shield',
  },
  identity: {
    coreAddress: 'identityWithdrawal',
    platformAddress: 'identityToAddress',
    identity: 'identityToIdentity',
  },
  shielded: {
    coreAddress: 'shieldedWithdrawal',
    platformAddress: 'unshield',
    newIdentity: 'identityCreateFromPool',
    shielded: 'shieldedTransfer',
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
  coreSend: {title: 'Send Dash', submitLabel: 'Send', unit: 'dash', feeCredits: null, minCredits: null},
  assetLockFunding: {title: 'Fund Platform address', submitLabel: 'Fund', unit: 'dash', feeCredits: null, minCredits: null},
  assetLockShield: {title: 'Shield from L1', submitLabel: 'Shield', unit: 'dash', feeCredits: null, minCredits: null},
  identityRegister: {title: 'Register identity', submitLabel: 'Register', unit: 'dash', feeCredits: null, minCredits: null},
  identityTopUpL1: {title: 'Top up identity from L1', submitLabel: 'Top up', unit: 'dash', feeCredits: null, minCredits: null},
  addressFundsTransfer: {title: 'Transfer credits', submitLabel: 'Send', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  identityTopUp: {title: 'Top up identity', submitLabel: 'Top up', unit: 'credits', feeCredits: 1_000_000n, minCredits: 100_000n},
  identityCreate: {title: 'Create identity', submitLabel: 'Create', unit: 'credits', feeCredits: 28_000_000n, minCredits: 500_000n},
  addressWithdrawal: {title: 'Withdraw to Core', submitLabel: 'Withdraw', unit: 'credits', feeCredits: 400_000_000n, minCredits: 100_000n},
  shield: {title: 'Shield credits', submitLabel: 'Shield', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  identityToAddress: {title: 'Send from identity', submitLabel: 'Send', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  identityToIdentity: {title: 'Send to identity', submitLabel: 'Send', unit: 'credits', feeCredits: 1_000_000n, minCredits: 100_000n},
  identityWithdrawal: {title: 'Withdraw from identity', submitLabel: 'Withdraw', unit: 'credits', feeCredits: 400_000_000n, minCredits: 100_000n},
  shieldedTransfer: {title: 'Send privately', submitLabel: 'Send', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  unshield: {title: 'Unshield', submitLabel: 'Unshield', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  shieldedWithdrawal: {title: 'Withdraw to L1', submitLabel: 'Withdraw', unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n},
  identityCreateFromPool: {title: 'Create identity from pool', submitLabel: 'Create', unit: 'credits', feeCredits: 0n, minCredits: 10_000_000_000n},
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
  {kind: 'core', label: 'Dash wallet (L1)'},
  {kind: 'platformAddress', label: 'Platform address'},
  {kind: 'identity', label: 'Identity'},
  {kind: 'shielded', label: 'Shielded balance'},
]

export const DESTINATION_KINDS: Array<{kind: DestinationKind; label: string}> = [
  {kind: 'coreAddress', label: 'Dash address (L1)'},
  {kind: 'platformAddress', label: 'Platform address'},
  {kind: 'identity', label: 'Identity'},
  {kind: 'newIdentity', label: 'New identity'},
  {kind: 'shielded', label: 'Shielded address'},
]
