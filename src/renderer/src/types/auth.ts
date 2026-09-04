import type { ConnectionType, Network } from '@renderer/api/types'

export type CreateWalletStep =
  | 'password'
  | 'seed-phrase'
  | 'verify'
  | 'connection-mode'
  | 'success'
  | 'welcome'
  | 'import-seed-phrase'
  | 'password-import'

export type WordCount = 12 | 24

export type WalletCreationPath = 'create' | 'import'

export interface UseCreateWalletState {
  step: CreateWalletStep
  password: string
  seedPhrase: string[]
  verifyPhrase: string[]
  wordCount: WordCount
  network: Network
  path: WalletCreationPath | null
  createdWalletId: string | null
  connectionMode: ConnectionType
  backgroundSyncEnabled: boolean
  setPassword: (password: string) => void
  setWordCount: (count: WordCount) => void
  generateSeedPhrase: () => Promise<void>
  verifyMissingWords: (words: string[]) => Promise<void>
  verifySeedPhrase: () => void
  goBack: () => void
  setNetwork: (network: Network) => void
  setConnectionMode: (mode: ConnectionType) => void
  setBackgroundSyncEnabled: (enabled: boolean) => void
  goToPassword: () => void
  goToImportSeedPhrase: () => void
  submitImportSeedPhrase: (phrase: string[]) => void
  continueImportedWallet: () => void
  finishWalletCreation: () => Promise<void>
}

export interface ConnectionModeStepProps {
  mode: ConnectionType
  backgroundSyncEnabled: boolean
  actionLabel: string
  loadingNotice: string
  onModeChange: (mode: ConnectionType) => void
  onBackgroundSyncChange: (enabled: boolean) => void
  onConfirm: () => Promise<void>
}
