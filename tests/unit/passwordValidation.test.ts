import { describe, it, expect } from 'vitest'
import { getPasswordValidationError } from '../../src/renderer/src/utils/passwordValidation'
import {
  MIN_WALLET_PASSWORD_LENGTH,
  MAX_WALLET_PASSWORD_LENGTH,
} from '../../src/renderer/src/constants/password'

describe('getPasswordValidationError', () => {
  it('rejects a password shorter than the minimum', () => {
    expect(getPasswordValidationError('a'.repeat(MIN_WALLET_PASSWORD_LENGTH - 1))).not.toBeNull()
  })

  it('accepts a password at the minimum length', () => {
    expect(getPasswordValidationError('a'.repeat(MIN_WALLET_PASSWORD_LENGTH))).toBeNull()
  })

  it('rejects a password longer than the maximum', () => {
    expect(getPasswordValidationError('a'.repeat(MAX_WALLET_PASSWORD_LENGTH + 1))).not.toBeNull()
  })

  it('trims surrounding whitespace before validating', () => {
    expect(getPasswordValidationError('   short   ')).not.toBeNull()
  })
})
