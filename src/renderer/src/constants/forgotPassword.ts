import { ForgotPasswordStep } from '../enums/ForgotPasswordStep'

export interface ForgotPasswordTexts {
  title: string
  description: Record<ForgotPasswordStep, string>
  form: {
    walletLabel: string
    newPasswordLabel: string
    newPasswordPlaceholder: string
    confirmPasswordLabel: string
    confirmPasswordPlaceholder: string
    continueButton: string
    resetButton: string
    backToLogin: string
  }
}

export const forgotPasswordTexts: ForgotPasswordTexts = {
  title: 'Reset Password',
  description: {
    [ForgotPasswordStep.Seed]: 'Enter the recovery phrase of the selected wallet to prove ownership.',
    [ForgotPasswordStep.Password]: 'Choose a new password.',
    [ForgotPasswordStep.Success]: 'Password updated.',
  },
  form: {
    walletLabel: 'Wallet',
    newPasswordLabel: 'New Password',
    newPasswordPlaceholder: 'Type New Password',
    confirmPasswordLabel: 'Confirm Password',
    confirmPasswordPlaceholder: 'Repeat New Password',
    continueButton: 'Continue',
    resetButton: 'Reset Password',
    backToLogin: 'Back to Login',
  },
}
