export type ForgotPasswordStep = 'seed' | 'password' | 'success'

export const MIN_WALLET_PASSWORD_LENGTH = 8
export const MAX_WALLET_PASSWORD_LENGTH = 128

export interface ForgotPasswordTexts {
  title: string
  description: {
    seed: string
    password: string
    success: string
  }
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
    seed: 'Enter the recovery phrase of the selected wallet to prove ownership.',
    password: 'The recovery phrase matches. Choose a new password for your wallet.',
    success: 'Your password has been updated. Log in with your new password.',
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
