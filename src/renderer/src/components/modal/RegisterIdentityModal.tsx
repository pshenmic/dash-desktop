import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, CrossIcon, Input, Text, SuccessIcon } from '../dash-ui-kit-enxtended'
import { useTheme } from 'dash-ui-kit/react'
import { API } from '@renderer/api'
import { davToDash } from '@renderer/utils/balance'
import Spinner from '@renderer/components/ui/Spinner'
import CopyableError from '@renderer/components/ui/CopyableError'
import CopyButton from '@renderer/components/ui/CopyButton'

interface RegisterIdentityModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  amountDuffs: string
  onSuccess: () => void
}

type Phase = 'confirm' | 'running' | 'done' | 'error'

interface RegisterResult {
  identifier: string
  stateTransitionHash: string
}

export default function RegisterIdentityModal({
  isOpen,
  onClose,
  walletId,
  amountDuffs,
  onSuccess,
}: RegisterIdentityModalProps): React.JSX.Element | null {
  const { theme } = useTheme()
  const [password, setPassword] = useState('')
  const [preError, setPreError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<Phase>('confirm')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RegisterResult | null>(null)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPreError(null)
      setBusy(false)
      setPhase('confirm')
      setError(null)
      setResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy) return
    setBusy(true)
    setPreError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setPreError('Incorrect password. Please try again.')
        setBusy(false)
        return
      }
    } catch (e) {
      setPreError(e instanceof Error ? e.message : 'Could not verify the password.')
      setBusy(false)
      return
    }

    setPhase('running')
    try {
      const registered = await API.registerIdentity(walletId, amountDuffs, password)
      setResult(registered)
      setPhase('done')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Identity registration failed.')
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  const requestClose = (): void => {
    if (phase === 'running') return
    onClose()
  }

  return createPortal(
    <div
      className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in"}
      onClick={requestClose}
    >
      <div
        className={"w-full max-w-140 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={"flex items-center justify-between"}>
          <Text size={24} weight={"extrabold"} color={"brand"}>
            {phase === 'done' ? 'Identity registered' : 'Register identity'}
          </Text>
          {phase !== 'running' && (
            <button
              className={"dash-text-default hover:opacity-60 cursor-pointer"}
              onClick={requestClose}
            >
              <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
            </button>
          )}
        </div>

        {phase === 'confirm' && (
          <div className={"phase-fade-in"} key={"confirm"}>
            <div className={"mt-4 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount to lock</Text>
                <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(BigInt(amountDuffs))} Dash</Text>
              </div>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Creates</Text>
                <Text size={12} weight={"medium"} color={"brand"}>New Platform identity with 6 keys</Text>
              </div>
            </div>

            <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-4 block"}>
              The locked Dash becomes the new identity's credit balance. The registration waits for the network to lock the L1 transaction — usually seconds, but up to a few minutes. Keep the app open until it finishes.
            </Text>
            <div className={"mt-2"}>
              <Input
                id={"register-identity-password"}
                type={"password"}
                placeholder={"Wallet password"}
                value={password}
                variant={"outlined"}
                onChange={(e) => { setPreError(null); setPassword(e.target.value) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
                className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
                colorScheme={preError ? 'error' : 'primary'}
                disabled={busy}
                autoFocus
              />
            </div>
            <div className={`overflow-hidden transition-all duration-200 ${preError ? 'max-h-12 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
              <CopyableError message={preError ?? ''} />
            </div>

            <div className={"mt-4.5 flex gap-2"}>
              <Button type={"button"} onClick={requestClose} variant={"solid"} colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'} size={"md"} className={"flex-1 rounded-[.9375rem]"} disabled={busy}>
                Cancel
              </Button>
              <Button type={"button"} onClick={handleConfirm} disabled={password.length === 0 || busy} variant={"solid"} colorScheme={"lightBlue-mint"} size={"md"} className={"flex-1 rounded-[.9375rem] gap-2"}>
                {busy && <Spinner size={16} />}
                {busy ? 'Checking…' : 'Confirm & Register'}
              </Button>
            </div>
          </div>
        )}

        {phase === 'running' && (
          <div className={"phase-fade-in"} key={"running"}>
            <div className={"mt-5 flex flex-col items-center gap-3 p-6 rounded-[.9375rem] dash-block"}>
              <Spinner size={32} className={"text-dash-brand dark:text-dash-mint"} />
              <Text size={14} weight={"medium"} color={"brand"}>Registering the identity…</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"text-center leading-[130%]"}>
                Locking Dash on L1, waiting for the network lock, then broadcasting the identity to Platform. Usually under a minute; the chain-lock fallback can take a few minutes.
              </Text>
            </div>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-3 block text-center"}>
              Do not close the app — this registration cannot be resumed yet.
            </Text>
          </div>
        )}

        {phase === 'error' && (
          <div className={"phase-fade-in"} key={"error"}>
            <div className={"mt-4 p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <CopyableError message={error ?? 'Identity registration failed.'} />
            </div>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-2 block"}>
              If the L1 lock was already broadcast, the locked Dash stays recoverable from this wallet's seed — retrying the registration reuses it.
            </Text>
            <div className={"mt-4.5 flex gap-2"}>
              <Button type={"button"} onClick={onClose} variant={"solid"} colorScheme={"lightBlue-mint"} size={"md"} className={"flex-1 rounded-[.9375rem]"}>
                Close
              </Button>
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div className={"phase-fade-in"} key={"done"}>
            <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
              <div className={"success-pop"}>
                <SuccessIcon size={56} />
              </div>
              <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>Identity registered</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
                The locked Dash is now this identity's credit balance.
              </Text>
            </div>
            <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>Identity</Text>
                <div className={"flex items-center gap-2 min-w-0"}>
                  <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{result.identifier}</Text>
                  <CopyButton text={result.identifier} className={"shrink-0"} />
                </div>
              </div>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>State transition</Text>
                <div className={"flex items-center gap-2 min-w-0"}>
                  <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{result.stateTransitionHash}</Text>
                  <CopyButton text={result.stateTransitionHash} className={"shrink-0"} />
                </div>
              </div>
            </div>
            <div className={"mt-4.5 flex gap-2"}>
              <Button type={"button"} onClick={onClose} variant={"solid"} colorScheme={"lightBlue-mint"} size={"md"} className={"flex-1 rounded-[.9375rem]"}>
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
