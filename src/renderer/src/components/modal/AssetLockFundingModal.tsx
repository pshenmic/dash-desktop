import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, CrossIcon, Input, Text, SuccessIcon, CheckIcon } from '../dash-ui-kit-enxtended'
import { useTheme } from 'dash-ui-kit/react'
import { API } from '@renderer/api'
import { AssetLockFundingState } from '@renderer/api/types'
import Spinner from '@renderer/components/ui/Spinner'
import HashField from '@renderer/components/ui/HashField'
import CopyableError from '@renderer/components/ui/CopyableError'
import CopyButton from '@renderer/components/ui/CopyButton'

interface AssetLockFundingModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  toPlatformAddress: string
  amountDuffs: string
  resume: boolean
  onSuccess: () => void
}

const PHASES = [
  { key: 'broadcastingL1', label: 'Broadcasting the L1 asset lock transaction' },
  { key: 'waitingChainLock', label: 'Waiting for a ChainLock (takes a few minutes)' },
  { key: 'broadcastingST', label: 'Crediting the Platform address' },
] as const

function phaseIndex(phase: string): number {
  if (phase === 'building' || phase === 'broadcastingL1') return 0
  if (phase === 'waitingChainLock') return 1
  if (phase === 'broadcastingST') return 2
  if (phase === 'done') return 3
  return 0
}

export default function AssetLockFundingModal({
  isOpen,
  onClose,
  walletId,
  toPlatformAddress,
  amountDuffs,
  resume,
  onSuccess,
}: AssetLockFundingModalProps): React.JSX.Element | null {
  const { theme } = useTheme()
  const [password, setPassword] = useState('')
  const [preError, setPreError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(false)
  const [state, setState] = useState<AssetLockFundingState | null>(null)
  const notified = useRef(false)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPreError(null)
      setBusy(false)
      setStarted(false)
      setState(null)
      notified.current = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!started || !walletId) return
    let dead = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async (): Promise<void> => {
      try {
        const next = await API.getAssetLockFundingState(walletId)
        if (dead) return
        setState(next)
        if (next.phase === 'done' && !notified.current) {
          notified.current = true
          onSuccess()
        }
        if (next.phase !== 'done' && next.phase !== 'error' && next.phase !== 'resumable') {
          timer = setTimeout(() => { void poll() }, 3000)
        }
      } catch {
        if (!dead) timer = setTimeout(() => { void poll() }, 3000)
      }
    }
    void poll()

    return () => {
      dead = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [started, walletId, onSuccess])

  if (!isOpen) return null

  const running = started && state != null && state.phase !== 'done' && state.phase !== 'error' && state.phase !== 'resumable'

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy || started) return
    setBusy(true)
    setPreError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setPreError('Incorrect password. Please try again.')
        setBusy(false)
        return
      }
      const initial = resume
        ? await API.resumeAssetLockFunding(walletId, password)
        : await API.startAssetLockFunding(walletId, toPlatformAddress, amountDuffs, password)
      setState(initial)
      setStarted(true)
      setBusy(false)
    } catch (e) {
      setPreError(e instanceof Error ? e.message : 'Could not start the funding.')
      setBusy(false)
    }
  }

  const requestClose = (): void => {
    onClose()
  }

  const isDone = state?.phase === 'done'
  const isError = started && (state?.phase === 'error' || state?.phase === 'resumable')

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
            {isDone ? 'Address funded' : resume ? 'Resume funding' : 'Fund Platform address'}
          </Text>
          <button
            className={"dash-text-default hover:opacity-60 cursor-pointer"}
            onClick={requestClose}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

        {!started && (
          <div className={"phase-fade-in"} key={"confirm"}>
            <div className={"mt-4 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              {amountDuffs.length > 0 && (
                <div className={"flex justify-between items-center gap-4"}>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount to lock</Text>
                  <Text size={14} weight={"extrabold"} color={"brand"}>{amountDuffs} duffs</Text>
                </div>
              )}
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>To (Platform)</Text>
                <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{toPlatformAddress}</Text>
              </div>
            </div>

            <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-4 block"}>
              Enter your wallet password. The funding waits for a ChainLock on the L1 transaction, which takes a few minutes. If the app is closed meanwhile, the funding can be resumed.
            </Text>
            <div className={"mt-2"}>
              <Input
                id={"asset-lock-password"}
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
                {busy ? 'Starting…' : resume ? 'Resume' : 'Confirm & Fund'}
              </Button>
            </div>
          </div>
        )}

        {running && state && (
          <div className={"phase-fade-in"} key={"progress"}>
            <div className={"mt-5 flex flex-col gap-4 p-[.875rem] rounded-[.9375rem] dash-block"}>
              {PHASES.map((p, i) => {
                const current = phaseIndex(state.phase)
                const done = i < current
                const active = i === current
                return (
                  <div key={p.key} className={"flex items-center gap-2"}>
                    {done
                      ? <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
                      : active
                        ? <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
                        : <div className={"size-3.5 rounded-full border border-dash-primary-dark-blue/20 dark:border-white/20"} />}
                    <Text size={14} weight={"medium"} color={"brand"} opacity={active || done ? 100 : 40}>{p.label}</Text>
                  </div>
                )
              })}
            </div>
            {state.txid && (
              <div className={"mt-3"}>
                <HashField hash={state.txid} label={"L1 txid"} />
              </div>
            )}
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-2 block"}>
              You can close this window — the funding keeps running and can be resumed from the Send page.
            </Text>
          </div>
        )}

        {isError && state && (
          <div className={"phase-fade-in"} key={"error"}>
            <div className={"mt-4 p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <CopyableError message={state.error ?? 'Funding failed.'} />
            </div>
            {state.txid && (
              <div className={"mt-3"}>
                <HashField hash={state.txid} label={"L1 txid"} />
              </div>
            )}
            {state.phase === 'resumable' && (
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-2 block"}>
                The locked Dash is safe — you can resume this funding from the Send page.
              </Text>
            )}
            <div className={"mt-4.5 flex gap-2"}>
              <Button type={"button"} onClick={onClose} variant={"solid"} colorScheme={"lightBlue-mint"} size={"md"} className={"flex-1 rounded-[.9375rem]"}>
                Close
              </Button>
            </div>
          </div>
        )}

        {isDone && state && (
          <div className={"phase-fade-in"} key={"done"}>
            <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
              <div className={"success-pop"}>
                <SuccessIcon size={56} />
              </div>
              <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>Platform address funded</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
                The locked Dash is now available as credits.
              </Text>
            </div>
            <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>To</Text>
                <div className={"flex items-center gap-2 min-w-0"}>
                  <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{state.toPlatformAddress}</Text>
                  {state.toPlatformAddress && <CopyButton text={state.toPlatformAddress} className={"shrink-0"} />}
                </div>
              </div>
              {state.stHash && (
                <div className={"flex justify-between items-center gap-4"}>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>State transition</Text>
                  <div className={"flex items-center gap-2 min-w-0"}>
                    <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{state.stHash}</Text>
                    <CopyButton text={state.stHash} className={"shrink-0"} />
                  </div>
                </div>
              )}
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
