import { AssetLockFundingKind } from '../enums/AssetLockFundingKind'
import { AssetLockFundingPhase } from '../enums/AssetLockFundingPhase'
import { AssetLockLockStep } from '../enums/AssetLockLockStep'
import { NEW_IDENTITY_LABEL } from './identityRegistration'
import type { AssetLockFundingPhaseLabel, AssetLockFundingTexts } from '../types/AssetLockFundingModal'

export const ASSET_LOCK_INSTANT_LOCK_FALLBACK_MS = 15_000

export const ASSET_LOCK_LOCK_STEP_LABELS: Record<AssetLockLockStep, string> = {
  [AssetLockLockStep.Pending]: 'Network lock',
  [AssetLockLockStep.WaitingInstantLock]: 'Waiting for InstantSend lock',
  [AssetLockLockStep.WaitingChainLock]: 'Waiting for ChainLock',
  [AssetLockLockStep.InstantLocked]: 'InstantSend lock received',
  [AssetLockLockStep.ChainLocked]: 'ChainLock received',
}

const BROADCAST_STEP: AssetLockFundingPhaseLabel = { key: AssetLockFundingPhase.BroadcastingL1, label: 'Broadcasting to L1' }
const LOCK_STEP: AssetLockFundingPhaseLabel = { key: AssetLockFundingPhase.WaitingChainLock, label: ASSET_LOCK_LOCK_STEP_LABELS[AssetLockLockStep.Pending] }

export const ASSET_LOCK_PHASE_LABELS: Record<AssetLockFundingKind, ReadonlyArray<AssetLockFundingPhaseLabel>> = {
  [AssetLockFundingKind.Address]: [BROADCAST_STEP, LOCK_STEP, { key: AssetLockFundingPhase.BroadcastingST, label: 'Crediting the Platform address' }],
  [AssetLockFundingKind.Shielded]: [BROADCAST_STEP, LOCK_STEP, { key: AssetLockFundingPhase.BroadcastingST, label: 'Proving and shielding the credits' }],
  [AssetLockFundingKind.Identity]: [BROADCAST_STEP, LOCK_STEP, { key: AssetLockFundingPhase.BroadcastingST, label: 'Registering the identity on Platform' }],
  [AssetLockFundingKind.IdentityTopUp]: [BROADCAST_STEP, LOCK_STEP, { key: AssetLockFundingPhase.BroadcastingST, label: 'Topping up the identity on Platform' }],
}

export const ASSET_LOCK_FUNDING_TEXTS: Record<AssetLockFundingKind, AssetLockFundingTexts> = {
  [AssetLockFundingKind.Address]: {
    title: 'Fund Platform address',
    resumeTitle: 'Resume funding',
    doneTitle: 'Address funded',
    doneHeading: 'Platform address funded',
    emptyTo: '',
    confirm: 'Sign & Send',
  },
  [AssetLockFundingKind.Shielded]: {
    title: 'Shield from L1',
    resumeTitle: 'Resume shielding',
    doneTitle: 'Credits shielded',
    doneHeading: 'Credits shielded',
    emptyTo: '',
    confirm: 'Sign & Send',
  },
  [AssetLockFundingKind.Identity]: {
    title: 'Register identity',
    resumeTitle: 'Resume registration',
    doneTitle: 'Identity registered',
    doneHeading: 'Identity registered',
    emptyTo: NEW_IDENTITY_LABEL,
    confirm: 'Sign & Send',
  },
  [AssetLockFundingKind.IdentityTopUp]: {
    title: 'Top up identity from L1',
    resumeTitle: 'Resume top-up',
    doneTitle: 'Identity topped up',
    doneHeading: 'Identity topped up',
    emptyTo: '',
    confirm: 'Sign & Send',
  },
}
