import { ForgotPasswordStep } from '../enums/ForgotPasswordStep'
import type { StepProgress } from '../types/StepProgress'

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

export const FORGOT_PASSWORD_PROGRESS: StepProgress<Record<Exclude<ForgotPasswordStep, ForgotPasswordStep.Success>, number>> = {
  totalSteps: 2,
  stepNumbers: {
    [ForgotPasswordStep.Seed]: 1,
    [ForgotPasswordStep.Password]: 2,
  },
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
    newPasswordPlaceholder: 'Type new password',
    confirmPasswordLabel: 'Confirm Password',
    confirmPasswordPlaceholder: 'Repeat new password',
    continueButton: 'Continue',
    resetButton: 'Reset Password',
    backToLogin: 'Back to Login',
  },
}
