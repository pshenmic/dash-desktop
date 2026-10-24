import type { IdentityKeyBoundsDto, IdentityKeyDto, IdentityKeyRequestDto } from '@renderer/api/types'
import { DASHPAY_CONTRACT_ID, DASHPAY_KEY_BOUNDS } from '@renderer/constants/dashPay'
import {
  DASHPAY_BOUNDS_LABEL,
  IDENTITY_KEY_LABEL_SEPARATOR,
  IDENTITY_KEY_LEVEL_LABELS,
  IDENTITY_KEY_PURPOSE_LABELS,
  IDENTITY_KEY_VARIANTS,
  IDENTITY_KEYS_PER_TRANSITION,
} from '@renderer/constants/identityKeys'
import type { IdentityKeyVariant } from '@renderer/enums/IdentityKeys'
import type { KeyBoundsLabel, KeySelectionCheck } from '@renderer/types/IdentityKeys'

function isDashPayBounds(bounds: IdentityKeyBoundsDto | null): boolean {
  return bounds?.contractId === DASHPAY_CONTRACT_ID
}

export function keyLabel(value: string, labels: Record<string, string>): string {
  return labels[value.toUpperCase()] ?? value
}

export function variantRequest(variant: IdentityKeyVariant): IdentityKeyRequestDto {
  const definition = IDENTITY_KEY_VARIANTS[variant]
  return {
    purpose: definition.purpose,
    securityLevel: definition.securityLevel,
    contractBounds: definition.dashPayBound ? { ...DASHPAY_KEY_BOUNDS } : null,
  }
}

export function variantOfRequest(request: IdentityKeyRequestDto): IdentityKeyVariant | null {
  const definition = Object.values(IDENTITY_KEY_VARIANTS).find(entry => entry.purpose === request.purpose
    && entry.securityLevel === request.securityLevel
    && entry.dashPayBound === isDashPayBounds(request.contractBounds))
  return definition?.variant ?? null
}

export function keysMatchingVariant(existing: IdentityKeyDto[], variant: IdentityKeyVariant): number {
  const definition = IDENTITY_KEY_VARIANTS[variant]
  return existing.filter(key => !key.disabled
    && key.purpose.toUpperCase() === definition.purpose
    && key.securityLevel.toUpperCase() === definition.securityLevel
    && isDashPayBounds(key.contractBounds) === definition.dashPayBound).length
}

export function validateKeySelection(selected: IdentityKeyVariant[]): KeySelectionCheck {
  return {
    count: selected.length,
    atLimit: selected.length >= IDENTITY_KEYS_PER_TRANSITION,
    overLimit: selected.length > IDENTITY_KEYS_PER_TRANSITION,
    empty: selected.length === 0,
  }
}

export function nextIdentityKeyId(keys: IdentityKeyDto[]): number {
  return keys.reduce((next, key) => Math.max(next, key.keyId + 1), 0)
}

export function keyBoundsLabel(bounds: IdentityKeyBoundsDto | null): KeyBoundsLabel | null {
  if (bounds == null) return null
  const isDashPay = isDashPayBounds(bounds)
  const owner = isDashPay ? DASHPAY_BOUNDS_LABEL : bounds.contractId
  return {
    text: bounds.documentType == null ? owner : `${owner}${IDENTITY_KEY_LABEL_SEPARATOR}${bounds.documentType}`,
    isDashPay,
  }
}

export function keyRequestLabel(request: IdentityKeyRequestDto): string {
  const parts = [keyLabel(request.purpose, IDENTITY_KEY_PURPOSE_LABELS), keyLabel(request.securityLevel, IDENTITY_KEY_LEVEL_LABELS)]
  if (request.contractBounds != null) {
    parts.push(isDashPayBounds(request.contractBounds) ? DASHPAY_BOUNDS_LABEL : request.contractBounds.contractId)
  }
  return parts.join(IDENTITY_KEY_LABEL_SEPARATOR)
}

export function projectedKeyIds(existing: IdentityKeyDto[], count: number): number[] {
  const first = nextIdentityKeyId(existing)
  return Array.from({ length: count }, (_, offset) => first + offset)
}
