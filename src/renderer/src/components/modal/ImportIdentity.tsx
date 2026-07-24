import {useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {useTheme} from 'dash-ui-kit/react'
import {API} from '@renderer/api'
import {IdentityImportResult} from '@renderer/api/types'
import {Button, CrossIcon, Input, PlusIcon, SuccessIcon, Text} from '../dash-ui-kit-enxtended'

interface ImportIdentityModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  onImported: () => void
}

interface KeyInput {
  id: number
  value: string
}

export default function ImportIdentity({
  isOpen,
  onClose,
  walletId,
  onImported,
}: ImportIdentityModalProps): React.JSX.Element | null {
  const {theme} = useTheme()
  const [identifier, setIdentifier] = useState('')
  const [keys, setKeys] = useState<KeyInput[]>([{id: 0, value: ''}])
  const [password, setPassword] = useState('')
  const [nextKeyId, setNextKeyId] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IdentityImportResult | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setIdentifier('')
    setKeys([{id: 0, value: ''}])
    setPassword('')
    setNextKeyId(1)
    setError(null)
    setLoading(false)
    setResult(null)
  }, [isOpen])

  if (!isOpen) return null

  const updateKey = (id: number, value: string): void => {
    setError(null)
    setKeys(current => current.map(key => key.id === id ? {...key, value} : key))
  }

  const addKey = (): void => {
    setKeys(current => [...current, {id: nextKeyId, value: ''}])
    setNextKeyId(current => current + 1)
  }

  const removeKey = (id: number): void => {
    setKeys(current => current.filter(key => key.id !== id))
  }

  const privateKeys = keys.map(key => key.value.trim()).filter(Boolean)
  const canSubmit = walletId != null && identifier.trim().length > 0 && privateKeys.length > 0 && password.length > 0 && !loading

  const handleImport = async (): Promise<void> => {
    if (!walletId || !canSubmit) return

    setLoading(true)
    setError(null)
    try {
      const imported = await API.importIdentity(walletId, identifier, privateKeys, password)
      setResult(imported)
      setPassword('')
      setKeys(current => current.map(key => ({...key, value: ''})))
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import this identity')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in px-4"}>
      <div className={"w-full max-w-145 max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={24} weight={"extrabold"} color={"brand"}>
            Import Platform identity
          </Text>
          <button
            type={"button"}
            className={"dash-text-default hover:opacity-60 cursor-pointer"}
            onClick={onClose}
            disabled={loading}
            aria-label={"Close"}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

        {result ? (
          <div className={"phase-fade-in"}>
            <div className={"mt-6 flex flex-col items-center text-center gap-3"}>
              <SuccessIcon size={48} />
              <Text size={18} weight={"bold"} color={"brand"}>Identity imported</Text>
              <Text size={12} weight={"medium"} color={"default"} opacity={50} className={"font-mono break-all"}>
                {result.identifier}
              </Text>
              <Text size={14} weight={"medium"} color={"default"} opacity={60}>
                Imported key IDs: {result.importedKeyIds.join(', ')}
              </Text>
              {!result.hasTransferKey && (
                <Text size={12} weight={"medium"} color={"red"}>
                  No transfer key was imported, so this wallet cannot move the identity balance.
                </Text>
              )}
            </div>
            <Button
              type={"button"}
              onClick={onClose}
              colorScheme={"primary"}
              size={"md"}
              className={"mt-6 w-full rounded-[.9375rem]"}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className={"phase-fade-in"}>
            <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-2 block"}>
              Add an existing identity to this wallet using one or more private keys. Keys are checked against Platform before they are encrypted and saved.
            </Text>

            <div className={"mt-5 flex flex-col gap-3"}>
              <Input
                id={"import-identity-identifier"}
                type={"text"}
                placeholder={"Identity identifier"}
                value={identifier}
                variant={"outlined"}
                onChange={(e) => {
                  setError(null)
                  setIdentifier(e.target.value)
                }}
                className={"h-14.25 rounded-[1.25rem] bg-transparent! font-mono"}
                colorScheme={error ? 'error' : 'primary'}
                disabled={loading}
                autoComplete={"off"}
                spellCheck={false}
                autoFocus
              />

              {keys.map((key, index) => (
                <div key={key.id} className={"flex items-center gap-2"}>
                  <Input
                    id={`import-identity-key-${key.id}`}
                    type={"password"}
                    placeholder={`Private key ${index + 1} (hex or WIF)`}
                    value={key.value}
                    variant={"outlined"}
                    onChange={(e) => updateKey(key.id, e.target.value)}
                    className={"h-14.25 rounded-[1.25rem] bg-transparent! font-mono"}
                    colorScheme={error ? 'error' : 'primary'}
                    disabled={loading}
                    autoComplete={"new-password"}
                    spellCheck={false}
                  />
                  {keys.length > 1 && (
                    <button
                      type={"button"}
                      onClick={() => removeKey(key.id)}
                      disabled={loading}
                      className={"size-10 shrink-0 rounded-full dash-subtle dash-text-default hover:opacity-60 cursor-pointer flex items-center justify-center"}
                      aria-label={`Remove private key ${index + 1}`}
                    >
                      <CrossIcon size={12} color={"currentColor"} />
                    </button>
                  )}
                </div>
              ))}

              <Button
                type={"button"}
                onClick={addKey}
                disabled={loading}
                variant={"solid"}
                colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'}
                size={"sm"}
                className={"self-start min-h-0! py-2! rounded-[.75rem]"}
              >
                <span className={"flex items-center gap-2"}>
                  <PlusIcon size={10} color={"currentColor"} />
                  Add another key
                </span>
              </Button>

              <Input
                id={"import-identity-password"}
                type={"password"}
                placeholder={"Wallet password"}
                value={password}
                variant={"outlined"}
                onChange={(e) => {
                  setError(null)
                  setPassword(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleImport()
                }}
                className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
                colorScheme={error ? 'error' : 'primary'}
                disabled={loading}
                autoComplete={"current-password"}
              />
            </div>

            <div className={"mt-4 rounded-[.9375rem] dash-subtle p-4"}>
              <Text size={12} weight={"medium"} color={"default"} opacity={60} className={"leading-[150%]"}>
                Important: your wallet recovery phrase does not restore imported identity keys. Keep your original private-key backup safe and never share it.
              </Text>
            </div>

            {error && (
              <Text size={12} weight={"medium"} color={"red"} className={"mt-3 block"}>
                {error}
              </Text>
            )}

            <div className={"mt-5 flex gap-2"}>
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
                onClick={handleImport}
                disabled={!canSubmit}
                variant={"solid"}
                colorScheme={"primary"}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
              >
                {loading ? 'Importing…' : 'Import identity'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
