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
    [ForgotPasswordStep.Password]: 'The recovery phrase matches. Choose a new password for your wallet.',
    [ForgotPasswordStep.Success]: 'Your password has been updated. Log in with your new password.',
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
