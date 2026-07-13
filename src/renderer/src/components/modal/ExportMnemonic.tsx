import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, CrossIcon, Input, Text } from '../dash-ui-kit-enxtended'
import { useTheme } from 'dash-ui-kit/react'
import { API } from '@renderer/api'
import SeedPhraseWarning from '@renderer/components/pages/auth/SeedPhraseWarning'

interface ExportMnemonicModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
}

export default function ExportMnemonic({
  isOpen,
  onClose,
  walletId,
}: ExportMnemonicModalProps): React.JSX.Element | null {
  const { theme } = useTheme()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [words, setWords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setError(null)
      setWords([])
      setLoading(false)
      setCopied(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleReveal = async (): Promise<void> => {
    if (!walletId || password.length === 0 || loading) return
    setLoading(true)
    setError(null)
    try {
      const mnemonic = await API.exportMnemonic(walletId, password)
      setWords(mnemonic.trim().split(/\s+/))
    } catch (e) {
      console.error('exportMnemonic failed', e)
      setError('Incorrect password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (): void => {
    navigator.clipboard
      .writeText(words.join(' '))
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }

  return createPortal(
    <div
      className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in"}
      onClick={onClose}
    >
      <div
        className={"w-full max-w-115 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={"flex items-center justify-between"}>
          <Text size={24} weight={"extrabold"} color={"brand"}>
            Recovery phrase
          </Text>
          <button
            className={"dash-text-default hover:opacity-60 cursor-pointer"}
            onClick={onClose}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

        {words.length === 0 ? (
          <div className={"phase-fade-in"} key={"confirm"}>
            <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-2 block"}>
              Enter your wallet password to reveal the secret recovery phrase.
            </Text>
            <div className={"mt-4.5"}>
              <Input
                id={"export-mnemonic-password"}
                type={"password"}
                placeholder={"Wallet password"}
                value={password}
                variant={"outlined"}
                onChange={(e) => {
                  setError(null)
                  setPassword(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReveal()
                }}
                className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
                colorScheme={error ? 'error' : 'primary'}
                disabled={loading}
                autoFocus
              />
            </div>
            <div
              className={`
                overflow-hidden transition-all duration-200
                ${error ? 'max-h-12 opacity-100 mt-2' : 'max-h-0 opacity-0'}
              `}
            >
              <Text size={12} weight={"medium"} color={"red"}>{error}</Text>
            </div>

            <div className={"mt-4.5 flex gap-2"}>
              <Button
                type={"button"}
                onClick={onClose}
                variant={"solid"}
                colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type={"button"}
                onClick={handleReveal}
                disabled={password.length === 0 || loading}
                variant={"solid"}
                colorScheme={"primary"}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
              >
                {loading ? 'Revealing…' : 'Reveal phrase'}
              </Button>
            </div>
          </div>
        ) : (
          <div className={"phase-fade-in"} key={"revealed"}>
            <div className={"mt-4"}>
              <SeedPhraseWarning
                title={"Never share your recovery phrase"}
                description={"Anyone with these words can spend your funds. Keep them offline and private."}
              />
            </div>

            <div className={"mt-4 grid grid-cols-3 gap-2.5"}>
              {words.map((word, index) => (
                <div
                  key={index}
                  className={"flex items-center gap-2 px-3 py-2.5 rounded-[.9375rem] border border-dash-primary-dark-blue/35 dark:border-white/35"}
                >
                  <Text size={12} weight={"medium"} color={"default"} opacity={30} className={"shrink-0"}>
                    {index + 1}.
                  </Text>
                  <Text size={12} weight={"medium"} color={"default"} className={"break-all"}>
                    {word}
                  </Text>
                </div>
              ))}
            </div>

            <div className={"mt-4.5 flex gap-2"}>
              <Button
                type={"button"}
                onClick={handleCopy}
                variant={"solid"}
                colorScheme={"lightBlue-mint"}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
              >
                {copied ? 'Copied' : 'Copy to clipboard'}
              </Button>
              <Button
                type={"button"}
                onClick={onClose}
                variant={"solid"}
                colorScheme={"primary"}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
