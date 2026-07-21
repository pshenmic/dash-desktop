export interface LoginTexts {
  title: string
  description: string
  form: {
    walletLabel: string
    walletPlaceholder: string
    passwordLabel: string
    passwordPlaceholder: string
    submitButton: string
  }
  links: {
    register: {
      label: string
      to: string
    }
    forgotPassword: {
      label: string
      to: string
    }
  }
}

export const loginTexts: LoginTexts = {
  title: 'Welcome Back',
  description: 'Use the password to unlock your wallet.',
  form: {
    walletLabel: 'Wallet',
    walletPlaceholder: 'Select your wallet',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Type Your Password',
    submitButton: 'Unlock',
  },
  links: {
    register: {
      label: 'Register wallet',
      to: '/create-wallet'
    },
    forgotPassword: {
      label: 'Forgot password?',
      to: '/forgot-password'
    },
  },
}
