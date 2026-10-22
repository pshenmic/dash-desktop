import type { IdentityKeyDto, IdentityKeyRequestDto } from '@renderer/api/types'
import { DASHPAY_REQUIRED_KEYS, DASHPAY_SETUP_COPY, DASHPAY_SIGNING_KEY, IDENTITY_KEY_SLOT_LIMIT } from '@renderer/constants/dashPay'
import { IDENTITY_KEY_TYPE_ECDSA } from '@renderer/constants/identityKeys'
import { DashPayReadiness, DashPaySetupStep, SetupStepState } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { DashPayReadinessInfo, SetupStepModel } from '@renderer/types/DashPay'
import { identityLabel } from './identifierFormat'

function keySatisfies(key: IdentityKeyDto, request: IdentityKeyRequestDto): boolean {
  return !key.disabled
    && key.keyType.toUpperCase() === IDENTITY_KEY_TYPE_ECDSA
    && key.purpose.toUpperCase() === request.purpose
    && key.securityLevel.toUpperCase() === request.securityLevel
}

export function keySlotsUsed(keys: IdentityKeyDto[]): number {
  return keys.reduce((used, key) => Math.max(used, key.keyId + 1), 0)
}

export function dashPayMissingKeys(keys: IdentityKeyDto[]): IdentityKeyRequestDto[] {
  return DASHPAY_REQUIRED_KEYS.filter(required => !keys.some(key => keySatisfies(key, required)))
}

function readinessOf(missing: number, slotsLeft: number, hasUsername: boolean): DashPayReadiness {
  if (missing > 0) return slotsLeft < missing ? DashPayReadiness.NoKeySlots : DashPayReadiness.NeedsKeys
  return hasUsername ? DashPayReadiness.Ready : DashPayReadiness.NoUsername
}

export function dashPayReadiness(identity: Pick<IdentityApiDto, 'aliasesList' | 'keys'>): DashPayReadinessInfo {
  const missingKeys = dashPayMissingKeys(identity.keys)
  const slotsUsed = keySlotsUsed(identity.keys)
  const slotsLeft = Math.max(0, IDENTITY_KEY_SLOT_LIMIT - slotsUsed)
  return {
    readiness: readinessOf(missingKeys.length, slotsLeft, identity.aliasesList.length > 0),
    canSend: missingKeys.length === 0,
    canRegister: identity.keys.some(key => keySatisfies(key, DASHPAY_SIGNING_KEY)),
    missingKeys,
    slotsUsed,
    slotsLeft,
  }
}

function keysStepState(readiness: DashPayReadinessInfo): SetupStepState {
  if (readiness.missingKeys.length === 0) return SetupStepState.Done
  return readiness.readiness === DashPayReadiness.NoKeySlots ? SetupStepState.Warning : SetupStepState.Todo
}

export function setupSteps(identity: IdentityApiDto | null, readiness: DashPayReadinessInfo | null): SetupStepModel[] {
  if (identity == null || readiness == null) {
    return [
      { step: DashPaySetupStep.Identity, state: SetupStepState.Todo, caption: DASHPAY_SETUP_COPY.noIdentity },
      { step: DashPaySetupStep.Username, state: SetupStepState.Todo, caption: DASHPAY_SETUP_COPY.afterIdentity },
      { step: DashPaySetupStep.Keys, state: SetupStepState.Todo, caption: DASHPAY_SETUP_COPY.afterIdentity },
    ]
  }
  const username = identity.aliasesList[0]
  return [
    {
      step: DashPaySetupStep.Identity,
      state: identity.balance.amount === 0n ? SetupStepState.Warning : SetupStepState.Done,
      caption: identityLabel(identity),
    },
    {
      step: DashPaySetupStep.Username,
      state: username == null ? SetupStepState.Todo : SetupStepState.Done,
      caption: username ?? DASHPAY_SETUP_COPY.usernameTodo,
    },
    {
      step: DashPaySetupStep.Keys,
      state: keysStepState(readiness),
      caption: readiness.missingKeys.length === 0 ? DASHPAY_SETUP_COPY.keysDone : DASHPAY_SETUP_COPY.keysTodo,
    },
  ]
}
