import type { IdentityKeyDto, IdentityKeysUpdateDto } from '../api/types'
import { DASHPAY_RECIPIENT_KEY_PURPOSES, IDENTITY_KEY_TYPE_ECDSA, MASTER_KEY_REQUEST } from '../constants/identityKeys'
import { IdentityKeyAction, IdentityKeyDashPayImpact, IdentityKeySecurityLevel } from '../enums/IdentityKeys'
import { dashPayMissingKeys } from './dashPayReadiness'
import { isIdentityKeyActive } from './identities'

export function identityKeyAction(key: Pick<IdentityKeyDto, 'disabledAt' | 'readOnly' | 'securityLevel'>): IdentityKeyAction | null {
  if (!isIdentityKeyActive(key) || key.readOnly) return null
  return key.securityLevel.toUpperCase() === IdentityKeySecurityLevel.Master ? IdentityKeyAction.ReplaceMaster : IdentityKeyAction.Disable
}

export function identityKeyUpdate(keyId: number, action: IdentityKeyAction): IdentityKeysUpdateDto {
  return { add: action === IdentityKeyAction.ReplaceMaster ? [{ ...MASTER_KEY_REQUEST }] : [], disable: [keyId] }
}

export function disableKeyDashPayImpact(keys: IdentityKeyDto[], target: IdentityKeyDto): IdentityKeyDashPayImpact | null {
  if (dashPayMissingKeys(keys.filter(key => key.keyId !== target.keyId)).length > dashPayMissingKeys(keys).length) {
    return IdentityKeyDashPayImpact.StopsDashPay
  }
  const canReceiveRequests = target.keyType.toUpperCase() === IDENTITY_KEY_TYPE_ECDSA
    && DASHPAY_RECIPIENT_KEY_PURPOSES.includes(target.purpose.toUpperCase())
  return canReceiveRequests ? IdentityKeyDashPayImpact.ContactRequests : null
}
