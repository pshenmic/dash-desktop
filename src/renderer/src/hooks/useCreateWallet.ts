import { useState, useCallback } from 'react'
import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { toast } from '../components/ui/Toast'
import { API } from '../api'
import { messages } from '@renderer/constants'
import { CONNECTION_MODE_PREVIOUS_STEPS, CREATE_WALLET_PREVIOUS_STEPS } from '@renderer/constants/auth'
import type { ConnectionType, Network } from '@renderer/api/types'
import type {
  CreateWalletStep,
  UseCreateWalletState,
  WalletCreationPath,
  WordCount,
} from '@renderer/types/auth'
import { saveWalletConnectionSettings } from '@renderer/utils/connectionSettings'

const VERIFY_HIDDEN_COUNT: Record<12 | 24, number> = {
  12: 4,
  24: 8,
}

function generateMnemonicWords(count: WordCount): string[] {
  const strength = count === 12 ? 128 : 256
  return generateMnemonic(wordlist, strength).split(' ')
}

function pickRandomIndices(total: number, count: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.slice(0, count).sort((a, b) => a - b)
}

function normalizeWord(w: string): string {
  return w.trim().toLowerCase()
}

export function useCreateWallet(): UseCreateWalletState {
  const [step, setStep] = useState<CreateWalletStep>('welcome')
  const [password, setPasswordState] = useState('')
  const [seedPhrase, setSeedPhrase] = useState<string[]>([])
  const [verifyPhrase, setVerifyPhrase] = useState<string[]>([])
  const [wordCount, setWordCountState] = useState<WordCount>(12)
  const [network, setNetwork] = useState<Network>('mainnet')
  const { createWallet: { invalidPhrase, phraseDoesNotMatch, couldNotCreateWallet } } = messages
  const [path, setPath] = useState<WalletCreationPath | null>(null)
  const [importedSeedPhrase, setImportedSeedPhrase] = useState<string[]>([])
  const [createdWalletId, setCreatedWalletId] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<ConnectionType>('rpc')
  const [backgroundSyncEnabled, setBackgroundSyncEnabled] = useState(true)

  const setPassword = useCallback((newPassword: string) => {
    setPasswordState(newPassword)
  }, [])

  const setWordCount = useCallback((count: WordCount) => {
    setWordCountState((prevCount) => {
      if (prevCount === count) return prevCount
      setSeedPhrase((prev) => (prev.length === 0 ? prev : generateMnemonicWords(count)))
      return count
    })
  }, [])

  const generateSeedPhrase = useCallback(async () => {
    const words = generateMnemonicWords(wordCount)
    setSeedPhrase(words)
    setStep('seed-phrase')
  }, [wordCount])

  const getVerifyPhrase = useCallback(() => {
    const n = seedPhrase.length
    if (n !== 12 && n !== 24) {
      setVerifyPhrase([])
      return
    }
    const hideCount = VERIFY_HIDDEN_COUNT[n]
    const hidden = new Set(pickRandomIndices(n, hideCount))
    setVerifyPhrase(seedPhrase.map((word, i) => (hidden.has(i) ? '' : word)))
  }, [seedPhrase])

  const verifyMissingWords = useCallback(
    async (words: string[]): Promise<void> => {
      if (words.length !== seedPhrase.length) {
        toast.error(invalidPhrase)
        return
      }
      const matches = words.every(
        (w, i) => normalizeWord(w) === normalizeWord(seedPhrase[i])
      )
      if (!matches) {
        toast.error(phraseDoesNotMatch)
        return
      }

      setStep('connection-mode')
    },
    [seedPhrase, invalidPhrase, phraseDoesNotMatch]
  )

  const verifySeedPhrase = useCallback(() => {
    getVerifyPhrase()
    setStep('verify')
  }, [getVerifyPhrase])

  const goBack = useCallback(() => {
    setStep((prev) => {
      if (prev === 'connection-mode') {
        return path === null ? prev : CONNECTION_MODE_PREVIOUS_STEPS[path]
      }

      const prevStep = CREATE_WALLET_PREVIOUS_STEPS[prev]
      if (!prevStep) return prev
      if (prev === 'verify') setVerifyPhrase([])
      if (prev === 'seed-phrase') {
        setSeedPhrase([])
        setPasswordState('')
      }
      if (prev === 'password' || prev === 'password-import') {
        setPasswordState('')
      }
      return prevStep
    })
  }, [path])

  const goToPassword = useCallback(() => {
    setPath('create')
    setStep('password')
  }, [])

  const goToImportSeedPhrase = useCallback(() => {
    setPath('import')
    setStep('import-seed-phrase')
  }, [])

  const continueImportedWallet = useCallback(() => {
    setStep('connection-mode')
  }, [])

  const finishWalletCreation = useCallback(async (): Promise<void> => {
    if (path === null) return

    const seedPhrases: Record<WalletCreationPath, string[]> = {
      create: seedPhrase,
      import: importedSeedPhrase,
    }

    let walletId: string
    try {
      walletId = await API.createWallet(seedPhrases[path].join(' '), network, password)
    } catch (err) {
      console.error('createWallet failed:', err)
      const message = err instanceof Error ? err.message : couldNotCreateWallet
      toast.error(couldNotCreateWallet + " " + message)
      return
    }

    const syncEnabled = connectionMode === 'p2p' || backgroundSyncEnabled
    saveWalletConnectionSettings(connectionMode, syncEnabled)
    setCreatedWalletId(walletId)
    setStep('success')
  }, [backgroundSyncEnabled, connectionMode, couldNotCreateWallet, importedSeedPhrase, network, password, path, seedPhrase])

  const submitImportSeedPhrase = useCallback((phrase: string[]) => {
    const isValid =
      (phrase.length === 12 || phrase.length === 24) && phrase.every((w) => w.trim().length > 0)

    if (!isValid) return
    setImportedSeedPhrase(phrase)
    setStep('password-import')
  }, [])

  return {
    step,
    password,
    seedPhrase,
    verifyPhrase,
    wordCount,
    setPassword,
    setWordCount,
    generateSeedPhrase,
    verifyMissingWords,
    verifySeedPhrase,
    goBack,
    network,
    setNetwork,
    goToPassword,
    goToImportSeedPhrase,
    submitImportSeedPhrase,
    path,
    createdWalletId,
    connectionMode,
    backgroundSyncEnabled,
    setConnectionMode,
    setBackgroundSyncEnabled,
    continueImportedWallet,
    finishWalletCreation,
  }
}
