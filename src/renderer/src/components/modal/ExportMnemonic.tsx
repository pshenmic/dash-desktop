import { useEffect, useState } from 'react'
import { Button, Text } from '../dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { authTexts, INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { ModalSize } from '@renderer/enums/ModalSize'
import SeedPhraseWarning from '@renderer/components/pages/auth/SeedPhraseWarning'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PasswordField from '@renderer/components/ui/PasswordField'

interface ExportMnemonicModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
}

export default function ExportMnemonic({
  isOpen,
  onClose,
  walletId,
}: ExportMnemonicModalProps): React.JSX.Element {
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

  const handleReveal = async (): Promise<void> => {
    if (!walletId || password.length === 0 || loading) return
    setLoading(true)
    setError(null)
    try {
      const mnemonic = await API.exportMnemonic(walletId, password)
      setWords(mnemonic.trim().split(/\s+/))
    } catch (e) {
      console.error('exportMnemonic failed', e)
      setError(INVALID_WALLET_PASSWORD_MESSAGE)
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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={"Recovery phrase"}
      size={ModalSize.Md}
    >
      {words.length === 0 ? (
        <div className={"phase-fade-in"} key={"confirm"}>
          <PasswordField
            id={"export-mnemonic-password"}
            value={password}
            onChange={(value) => {
              setError(null)
              setPassword(value)
            }}
            onSubmit={handleReveal}
            error={error}
            disabled={loading}
            className={"mt-4.5"}
          />

          <ModalActions
            secondary={{ label: 'Cancel', onClick: onClose, disabled: loading }}
            primary={{
              label: loading ? 'Revealing…' : 'Reveal phrase',
              onClick: handleReveal,
              disabled: password.length === 0 || loading,
            }}
          />
        </div>
      ) : (
        <div className={"phase-fade-in"} key={"revealed"}>
          <div className={"mt-4"}>
            <SeedPhraseWarning {...authTexts.seedPhraseWarning} />
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
              size={"sm"}
              className={"flex-1 rounded-[.9375rem]"}
            >
              {copied ? 'Copied' : 'Copy to clipboard'}
            </Button>
            <Button
              type={"button"}
              onClick={onClose}
              variant={"solid"}
              colorScheme={"primary"}
              size={"sm"}
              className={"flex-1 rounded-[.9375rem]"}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
