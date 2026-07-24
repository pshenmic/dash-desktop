import { MIN_WALLET_PASSWORD_LENGTH, MAX_WALLET_PASSWORD_LENGTH } from '../constants/password'
import { messages } from '../constants/messages'

const { createWallet: { passwordValidation: { minLength, maxLength } } } = messages

export function getPasswordValidationError(password: string): string | null {
  const trimmed = password.trim()
  if (trimmed.length < MIN_WALLET_PASSWORD_LENGTH) {
    return minLength
  }
  if (trimmed.length > MAX_WALLET_PASSWORD_LENGTH) {
    return maxLength
  }
  return null
}
