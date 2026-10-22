import type { IdentityKeyDto } from '@renderer/api/types'
import {
  IDENTITY_KEY_LABEL_SEPARATOR,
  IDENTITY_KEY_LEVEL_LABELS,
  IDENTITY_KEY_PURPOSE_LABELS,
  IDENTITY_KEYS_PER_TRANSITION,
  KEY_COUNT_COPY,
  KEY_VARIANT_ORDER,
} from '@renderer/constants/identityKeys'
import { IdentityKeyVariant } from '@renderer/enums/IdentityKeys'
import type { IdentityKeyVariantDefinition } from '@renderer/types/IdentityKeys'
import { dashPayMissingKeys } from './dashPayReadiness'
import { keyLabel, variantOfRequest } from './identityKeyRequests'

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

export function keyVariantTitle(definition: IdentityKeyVariantDefinition): string {
  return [keyLabel(definition.purpose, IDENTITY_KEY_PURPOSE_LABELS), keyLabel(definition.securityLevel, IDENTITY_KEY_LEVEL_LABELS)]
    .join(IDENTITY_KEY_LABEL_SEPARATOR)
}

export function keySelectionLabel(count: number): string {
  if (count === 0) return `${KEY_COUNT_COPY.upTo} ${IDENTITY_KEYS_PER_TRANSITION} ${KEY_COUNT_COPY.perTransition}`
  const selected = `${count} ${KEY_COUNT_COPY.of} ${IDENTITY_KEYS_PER_TRANSITION} ${KEY_COUNT_COPY.selected}`
  return count < IDENTITY_KEYS_PER_TRANSITION ? selected : `${selected} ${KEY_COUNT_COPY.limitReached}`
}

export function identityKeysCountLabel(count: number): string {
  return `${count} ${count === 1 ? KEY_COUNT_COPY.key : KEY_COUNT_COPY.keys}`
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
