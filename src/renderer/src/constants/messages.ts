export interface Messages {
  createWallet: {
    invalidPhrase: string
    phraseDoesNotMatch: string
    couldNotCreateWallet: string
    passwordValidation: {
      minLength: string
      maxLength: string
      passwordsDoNotMatch: string
    }
    seedPhrase: {
      errorMessage: string
      errorTitle: string
    }
  }
  login: {
    invalidPassword: string
  }
  forgotPassword: {
    seedMismatch: string
    resetFailed: string
  }
}

export const INVALID_WALLET_PASSWORD_MESSAGE = 'Invalid wallet password'

export const messages: Messages = {
  createWallet: {
    invalidPhrase: "**Invalid phrase** Word count does not match your recovery phrase.",
    phraseDoesNotMatch: "**Recovery phrase does not match** Check the words you entered and try again.",
    couldNotCreateWallet: "**Could not create wallet**",

    passwordValidation: {
      minLength: '**Check your password** Password must contain at least 8 characters.',
      maxLength: '**Check your password** Password must be at most 128 characters.',
      passwordsDoNotMatch: '**Check your password** Passwords do not match.',
    },

    seedPhrase: {
      errorMessage: 'Unexpected error while generating seed phrase.',
      errorTitle: '**Something went wrong**',
    },
  },
  login: {
    invalidPassword: "**Invalid password** please try again.",
  },
  forgotPassword: {
    seedMismatch: "**Recovery phrase does not match** This phrase does not belong to the selected wallet.",
    resetFailed: "**Could not reset password** Please try again.",
  }
}
