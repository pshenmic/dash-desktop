import { describe, expect, it } from 'vitest'
import { registrationReturnTarget } from '../../src/renderer/src/utils/registrationReturn'
import { RegistrationReturnTarget } from '../../src/renderer/src/enums/RegistrationReturnTarget'
import { REGISTRATION_RETURN_TARGETS } from '../../src/renderer/src/constants/registrationReturn'

describe('registrationReturnTarget', () => {
  it('returns to DashPay only for the allowlisted value', () => {
    expect(registrationReturnTarget('dashpay')).toBe(RegistrationReturnTarget.DashPay)
    expect(REGISTRATION_RETURN_TARGETS[registrationReturnTarget('dashpay')].path).toBe('/dashpay')
  })

  it('keeps the Identities page for anything else', () => {
    for (const raw of [null, '', 'DashPay', '/dashpay', 'https://example.com']) {
      expect(registrationReturnTarget(raw)).toBe(RegistrationReturnTarget.Identities)
    }
    expect(REGISTRATION_RETURN_TARGETS[RegistrationReturnTarget.Identities]).toEqual({ path: '/identities', backLabel: 'Back to identities' })
  })
})
