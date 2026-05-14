import { useState, useCallback } from 'react'
import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { toast } from '../components/ui/Toast'
import { API } from '../api'
import { messages } from '@renderer/constants'
import { Network } from '@renderer/api/types'

export type CreateWalletStep =
  | 'password'
  | 'seed-phrase'
  | 'verify'
  | 'success'
  | 'select-network'
  | 'welcome'
  | 'import-seed-phrase'
  | 'password-import'
export type WordCount = 12 | 24

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

type Path = 'create' | 'import' | null

export interface TypeUseCreateWallet {
  step: CreateWalletStep
  password: string
  seedPhrase: string[]
  verifyPhrase: string[]
  wordCount: WordCount
  network: Network
  path: Path
  setPassword: (password: string) => void
  setWordCount: (count: WordCount) => void
  generateSeedPhrase: () => Promise<void>
  verifyMissingWords: (words: string[]) => void
  verifySeedPhrase: () => void
  goBack: () => void
  setNetwork: (network: Network) => void
  goToWelcome: () => void
  goToPassword: () => void
  goToImportSeedPhrase: () => void
  submitImportSeedPhrase: (phrase: string[]) => void
  createImportedWallet: () => Promise<void>
}

const PREV_STEP: Partial<Record<CreateWalletStep, CreateWalletStep>> = {
  'password':           'welcome',
  'seed-phrase':        'password',
  'verify':             'seed-phrase',
  'welcome':            'select-network',
  'import-seed-phrase': 'welcome',
  'password-import': 'import-seed-phrase',
}

export function useCreateWallet(): TypeUseCreateWallet {
  const [step, setStep] = useState<CreateWalletStep>('select-network')
  const [password, setPasswordState] = useState('')
  const [seedPhrase, setSeedPhrase] = useState<string[]>([])
  const [verifyPhrase, setVerifyPhrase] = useState<string[]>([])
  const [wordCount, setWordCountState] = useState<WordCount>(12)
  const [network, setNetwork] = useState<Network>('mainnet')
  const [importSeedPhrase, setImportSeedPhrase] = useState(false)
  const { createWallet: { invalidPhrase, phraseDoesNotMatch, couldNotCreateWallet } } = messages
  const [path, setPath] = useState<Path>(null)
  const [importedSeedPhrase, setImportedSeedPhrase] = useState<string[]>([])

  const setPassword = useCallback((newPassword: string) => {
    setPasswordState(newPassword)
  }, [])

  const setWordCount = useCallback((count: WordCount) => {
    setWordCountState(count)
    setSeedPhrase((prev) => {
      if (prev.length === 0) return prev
      return generateMnemonicWords(count)
    })
  }, [])

  const generateSeedPhrase = useCallback(async () => {
    if (importSeedPhrase) {
      setStep('import-seed-phrase')
    } else {
    const words = generateMnemonicWords(wordCount)
    setSeedPhrase(words)
    setStep('seed-phrase')
    }
  }, [wordCount, importSeedPhrase])

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
    (words: string[]) => {
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

      API.createWallet(seedPhrase.join(' '), network, password)
        .then(() => setStep('success'))
        .catch((err) => {
          console.error('createWallet failed:', err)
          const message = err instanceof Error ? err.message : couldNotCreateWallet
          toast.error(couldNotCreateWallet + " " + message)
        })
    },
    [seedPhrase, network, password]
  )

  const verifySeedPhrase = useCallback(() => {
    getVerifyPhrase()
    setStep('verify')
  }, [getVerifyPhrase])

  const goBack = useCallback(() => {
    setStep((prev) => {
      const prevStep = PREV_STEP[prev]
      if (!prevStep) return prev
      if (prev === 'verify') setVerifyPhrase([])
      if (prev === 'seed-phrase') {
        setSeedPhrase([])
        setPassword('')
      }
      return prevStep
    })
  }, [])

  const goToWelcome = useCallback(() => {
    setStep('welcome')
  }, [])

  const goToPassword = useCallback(() => {
    setPath('create')
    setStep('password')
  }, [])

  const goToImportSeedPhrase = useCallback(() => {
    setPath('import')
    setStep('import-seed-phrase')
    setImportSeedPhrase(true)
  }, [setImportSeedPhrase])

  const createImportedWallet = useCallback((): Promise<void> => {
    return API.createWallet(importedSeedPhrase.join(' '), network, password)
      .then(() => setStep('success'))
      .catch((err) => {
        console.error('createWallet failed:', err)
        const message = err instanceof Error ? err.message : couldNotCreateWallet
        toast.error(couldNotCreateWallet + " " + message)
      })
  }, [importedSeedPhrase, network, password])

  const submitImportSeedPhrase = useCallback((phrase: string[]) => {
    const isValid =
      (phrase.length === 12 || phrase.length === 24) && phrase.every((w) => w.trim().length > 0)

    if (!isValid) return
    setImportedSeedPhrase(phrase)
    setStep('password-import')
  }, [network, password])

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
    goToWelcome,
    goToPassword,
    goToImportSeedPhrase,
    submitImportSeedPhrase,
    createImportedWallet,
    path
  }
}
