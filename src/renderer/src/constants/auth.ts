import type { CreateWalletStep, WalletCreationPath } from '@renderer/types/auth'

export interface BaseTexts {
  title: string
  description: string
}

export interface CreateWalletTexts extends BaseTexts {
  labelPassword: string
  labelConfirmPassword: string
  placeholderPassword: string
  placeholderConfirmPassword: string
  buttonNext: string
  importWallet: string
  slowCreationNotice: string
}

export interface SaveYourSeedPhraseTexts extends BaseTexts {
  buttonContinue: string
  buttonCopy: string
}

export interface FillInYourSeedPhraseTexts extends BaseTexts{
  buttonContinue: string
}

export interface SuccessTexts extends BaseTexts {
  subtitle: string
  buttonContinue: string
}

export interface WelcomeTexts {
  titlePrefix: string
  titleHighlight: string
  description: string
  buttonCreateWallet: string
  buttonImportSeedPhrase: string
}

export interface ImportSeedPhraseTexts extends BaseTexts {
  title: string
  description: string
  buttonContinue: string
}

export interface ConnectionModeTexts extends BaseTexts {
  backgroundSyncTitle: string
  backgroundSyncDescription: string
  requiredSyncTitle: string
  requiredSyncDescription: string
  buttonCreate: string
  buttonImport: string
}

export interface AuthTexts {
  createWallet: CreateWalletTexts
  saveYourSeedPhrase: SaveYourSeedPhraseTexts
  fillInYourSeedPhrase: FillInYourSeedPhraseTexts
  seedPhraseWarning: BaseTexts
  success: SuccessTexts,
  successImport: SuccessTexts,
  welcome: WelcomeTexts,
  importSeedPhrase: ImportSeedPhraseTexts,
  connectionMode: ConnectionModeTexts,
}

export const CREATE_WALLET_PREVIOUS_STEPS: Partial<Record<CreateWalletStep, CreateWalletStep>> = {
  password: 'welcome',
  'seed-phrase': 'password',
  verify: 'seed-phrase',
  'import-seed-phrase': 'welcome',
  'password-import': 'import-seed-phrase',
}

export const CONNECTION_MODE_PREVIOUS_STEPS: Record<WalletCreationPath, CreateWalletStep> = {
  create: 'verify',
  import: 'password-import',
}

export const CREATE_WALLET_PROGRESS: Record<WalletCreationPath, {
  totalSteps: number
  stepNumbers: Partial<Record<CreateWalletStep, number>>
}> = {
  create: {
    totalSteps: 4,
    stepNumbers: {
      password: 1,
      'seed-phrase': 2,
      verify: 3,
      'connection-mode': 4,
    },
  },
  import: {
    totalSteps: 3,
    stepNumbers: {
      'import-seed-phrase': 1,
      'password-import': 2,
      'connection-mode': 3,
    },
  },
}

export const authTexts: AuthTexts = {
  createWallet: {
    title: 'Create Wallet',
    description: 'You will use this password to unlock your wallet. Do not share your password with others',
    labelPassword: 'Password',
    labelConfirmPassword: 'Confirm Password',
    placeholderPassword: 'Type Your Password',
    placeholderConfirmPassword: 'Repeat your Password',
    buttonNext: 'Next',
    importWallet: 'Import wallet instead',
    slowCreationNotice: 'Securing your wallet is in the progress. Don\'t worry, it will take a few more seconds.'
  },
  saveYourSeedPhrase: {
    title: 'Save your Seed Phrase',
    description: 'This recovery phrase is your wallet\'s only backup. If you lose it, no one can help you access your funds. Your recovery phrase is safest when written on paper and stored in a secure place.',
    buttonContinue: 'Continue',
    buttonCopy: 'Copy'
  },
  fillInYourSeedPhrase: {
    title: 'Fill in your Seed Phrase',
    description: 'This recovery phrase is your wallet\'s only backup. If you lose it, no one can help you access your funds. Your recovery phrase is safest when written on paper and stored in a secure place.',
    buttonContinue: 'Continue'
  },
  seedPhraseWarning: {
    title: 'DO NOT share your recovery phrase with ANYONE.',
    description: 'Anyone with your recovery phrase can have full control over your assets. Please stay vigilant against phishing attacks at all times.'
  },
  success: {
    title: 'Your Wallet Was',
    subtitle: 'Succesfully Created',
    description: 'Enjoy the best Desktop Experience for Dash!',
    buttonContinue: 'Continue'
  },
  successImport: {
    title: 'Your Wallet Was',
    subtitle: 'Succesfully Imported',
    description: 'Enjoy the best Desktop Experience for Dash!',
    buttonContinue: 'Continue'
  },
  welcome: {
    titlePrefix: 'Welcome to',
    titleHighlight: 'Dash Desktop Wallet',
    description: 'Enjoy all the benefits of using Dash on your desktop device',
    buttonCreateWallet: 'Create Wallet',
    buttonImportSeedPhrase: 'Import Seed Phrase',
  },
  importSeedPhrase: {
    title: 'Import your Seed Phrase',
    description: 'Paste your existing Dash Seed Phrase',
    buttonContinue: 'Continue'
  },
  connectionMode: {
    title: 'Choose a connection mode',
    description: 'You can change this later in Connection Settings.',
    backgroundSyncTitle: 'Synchronize P2P in the background',
    backgroundSyncDescription: 'Use RPC immediately while the private P2P data source prepares in the background.',
    requiredSyncTitle: 'P2P synchronization is required',
    requiredSyncDescription: 'The wallet will start synchronizing as soon as creation is complete.',
    buttonCreate: 'Create Wallet',
    buttonImport: 'Import Wallet',
  },
}
