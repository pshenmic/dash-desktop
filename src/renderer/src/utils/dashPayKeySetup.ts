import type { IdentityKeyDto } from '@renderer/api/types'
import { IDENTITY_KEY_SLOT_LIMIT } from '@renderer/constants/dashPay'
import { ENABLE_DASHPAY_COPY, KEY_COUNT_COPY, KEY_SHORTFALL_COPY, KEY_VARIANT_ORDER } from '@renderer/constants/dashPayKeys'
import {
  IDENTITY_KEY_LABEL_SEPARATOR,
  IDENTITY_KEY_LEVEL_LABELS,
  IDENTITY_KEY_PURPOSE_LABELS,
} from '@renderer/constants/identityKeys'
import { IdentityKeyVariant, KeysShortfallKind } from '@renderer/enums/DashPay'
import type { KeysShortfall, KeysShortfallInput } from '@renderer/types/DashPayKeys'
import type { IdentityKeyVariantDefinition } from '@renderer/types/IdentityKeys'
import { creditsToDash } from './balance'
import { dashPayMissingKeys } from './dashPayReadiness'
import { keyLabel, variantOfRequest } from './identityKeyRequests'

export function keySlotPercent(used: number): number {
  return Math.min(100, Math.max(0, (used / IDENTITY_KEY_SLOT_LIMIT) * 100))
}

export function sortedIdentityKeys(keys: IdentityKeyDto[]): IdentityKeyDto[] {
  return [...keys].sort((a, b) => a.keyId - b.keyId)
}

export function toggleKeyVariant(selected: IdentityKeyVariant[], variant: IdentityKeyVariant, checked: boolean): IdentityKeyVariant[] {
  return KEY_VARIANT_ORDER.filter(entry => (entry === variant ? checked : selected.includes(entry)))
}

export function presetKeyVariants(keys: IdentityKeyDto[]): IdentityKeyVariant[] {
  const variants = dashPayMissingKeys(keys).map(variantOfRequest)
  return KEY_VARIANT_ORDER.filter(variant => variants.includes(variant))
}

export function keysShortfall({ requested, slotsLeft, feeCredits, feeError, balance }: KeysShortfallInput): KeysShortfall | null {
  if (requested > slotsLeft) return { kind: KeysShortfallKind.Slots, slotsLeft }
  if (feeError != null) return { kind: KeysShortfallKind.FeeError }
  if (feeCredits != null && balance < feeCredits) return { kind: KeysShortfallKind.Balance, missingCredits: feeCredits - balance }
  return null
}

export function keyVariantTitle(definition: IdentityKeyVariantDefinition): string {
  return [keyLabel(definition.purpose, IDENTITY_KEY_PURPOSE_LABELS), keyLabel(definition.securityLevel, IDENTITY_KEY_LEVEL_LABELS)]
    .join(IDENTITY_KEY_LABEL_SEPARATOR)
}

export function keySlotsUsedLabel(used: number): string {
  return `${used} ${KEY_COUNT_COPY.of} ${IDENTITY_KEY_SLOT_LIMIT} ${KEY_COUNT_COPY.slotsUsed}`
}

export function keySlotsLeftAfterLabel(leftAfter: number): string {
  return `${KEY_COUNT_COPY.separator} ${leftAfter} ${KEY_COUNT_COPY.leftAfter}`
}

export function keySlotsLeftLabel(slotsLeft: number): string {
  if (slotsLeft === 0) return KEY_COUNT_COPY.noSlotsLeft
  return `${KEY_COUNT_COPY.only} ${slotsLeft} ${slotsLeft === 1 ? KEY_COUNT_COPY.slotLeft : KEY_COUNT_COPY.slotsLeft}`
}

export function keysOnIdentityLabel(count: number): string {
  return `${count} ${KEY_COUNT_COPY.onIdentity}`
}

export function keysAddedLabel(count: number): string {
  return `${count} ${count === 1 ? KEY_COUNT_COPY.keyAdded : KEY_COUNT_COPY.keysAdded}`
}

export function projectedKeyLabel(keyId: number, label: string): string {
  return `${KEY_COUNT_COPY.idPrefix}${keyId} ${label}`
}

export function enableDashPayDescription(name: string): string {
  return `${ENABLE_DASHPAY_COPY.descriptionLead} ${name} ${ENABLE_DASHPAY_COPY.descriptionTail}`
}

export function dashPayEnabledHeadline(name: string): string {
  return `${ENABLE_DASHPAY_COPY.doneLead} ${name}`
}

export function creditsShortfallLabel(name: string, missingCredits: bigint): string {
  return `${name} ${KEY_SHORTFALL_COPY.needs} ${creditsToDash(missingCredits)} ${KEY_SHORTFALL_COPY.more}`
}

export function keysShortfallMessage(shortfall: KeysShortfall, name: string): string {
  if (shortfall.kind === KeysShortfallKind.Slots) return keySlotsLeftLabel(shortfall.slotsLeft)
  if (shortfall.kind === KeysShortfallKind.FeeError) return KEY_SHORTFALL_COPY.feeError
  return creditsShortfallLabel(name, shortfall.missingCredits)
}
