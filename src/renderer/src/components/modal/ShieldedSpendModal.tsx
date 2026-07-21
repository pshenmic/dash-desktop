import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, CrossIcon, Input, Text, SuccessIcon, CheckIcon } from '../dash-ui-kit-enxtended'
import HashField from '@renderer/components/ui/HashField'
import CopyableError from '@renderer/components/ui/CopyableError'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import { useTheme } from 'dash-ui-kit/react'
import { API } from '@renderer/api'
import { ShieldedSpendState } from '@renderer/api/types'
import { ShieldedSpendPhase } from '@renderer/enums/ShieldedSpendPhase'
import Spinner from '@renderer/components/ui/Spinner'
import { SHIELDED_SPEND_POLL_MS, SHIELDED_SPEND_RETRY_MS } from '@renderer/constants'

interface ShieldedSpendModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  title: string
  toLabel: string
  toValue: string
  amountCredits: string
  proverReady: boolean
  start: (password: string) => Promise<ShieldedSpendState>
  onSuccess: () => void
}

const PHASES = [
  { key: ShieldedSpendPhase.Syncing, label: 'Syncing notes' },
  { key: ShieldedSpendPhase.Proving, label: 'Generating zero-knowledge proof' },
  { key: ShieldedSpendPhase.Broadcasting, label: 'Broadcasting' },
] as const

function phaseIndex(phase: ShieldedSpendPhase): number {
  return PHASES.findIndex(p => p.key === phase)
}


export default function ShieldedSpendModal({
  isOpen,
  onClose,
  walletId,
  title,
  toLabel,
  toValue,
  amountCredits,
  proverReady,
  start,
  onSuccess,
}: ShieldedSpendModalProps): React.JSX.Element | null {
  const { theme } = useTheme()
  const [password, setPassword] = useState('')
  const [preError, setPreError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(false)
  const [spend, setSpend] = useState<ShieldedSpendState | null>(null)
  const [sentAmount, setSentAmount] = useState('')
  const notified = useRef(false)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPreError(null)
      setBusy(false)
      setStarted(false)
      setSpend(null)
      setSentAmount('')
      notified.current = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!started || !walletId) return
    let dead = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async (): Promise<void> => {
      try {
        const next = await API.getShieldedSpendState(walletId)
        if (dead) return
        setSpend(next)
        if (next.phase === ShieldedSpendPhase.Done && !notified.current) {
          notified.current = true
          onSuccess()
        }
        if (next.phase !== ShieldedSpendPhase.Done && next.phase !== ShieldedSpendPhase.Error) {
          timer = setTimeout(() => { void poll() }, SHIELDED_SPEND_POLL_MS)
        }
      } catch {
        if (!dead) timer = setTimeout(() => { void poll() }, SHIELDED_SPEND_RETRY_MS)
      }
    }
    void poll()

    return () => {
      dead = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [started, walletId, onSuccess])

  if (!isOpen) return null

  const running = started && spend != null && spend.phase !== ShieldedSpendPhase.Done && spend.phase !== ShieldedSpendPhase.Error

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy || !proverReady || started) return
    setBusy(true)
    setPreError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setPreError('Incorrect password. Please try again.')
        setBusy(false)
        return
      }
      setSentAmount(amountCredits)
      const initial = await start(password)
      setSpend(initial)
      setStarted(true)
      setBusy(false)
    } catch (e) {
      setPreError(e instanceof Error ? e.message : 'Could not start.')
      setBusy(false)
    }
  }

  const retry = (): void => {
    setStarted(false)
    setSpend(null)
    setPassword('')
    setPreError(null)
    notified.current = false
  }

  const requestClose = (): void => {
    if (running) return
    onClose()
  }

  const isDone = spend?.phase === ShieldedSpendPhase.Done
  const isError = started && spend?.phase === ShieldedSpendPhase.Error
  const confirmLabel = busy ? 'Starting…' : !proverReady ? 'Preparing…' : 'Confirm & Send'

  return createPortal(
    <div
      className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in"}
    >
      <div
        className={"w-full max-w-140 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}
      >
        <div className={"flex items-center justify-between"}>
          <Text size={24} weight={"extrabold"} color={"brand"}>
            {isDone ? (spend?.identityId ? 'Identity created' : 'Sent privately') : title}
          </Text>
          <button
            className={"dash-text-default hover:opacity-60 cursor-pointer disabled:opacity-30 disabled:cursor-default"}
            onClick={requestClose}
            disabled={running}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

        {!started && (
          <div className={"phase-fade-in"} key={"confirm"}>
            <div className={"mt-4 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
                <Text size={14} weight={"extrabold"} color={"brand"}><CreditsAmount credits={BigInt(amountCredits)} align={"end"} /></Text>
              </div>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{toLabel}</Text>
                <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{toValue}</Text>
              </div>
            </div>

            <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-4 block"}>
              Enter your wallet password. Syncing and proving can take a little while.
            </Text>
            <div className={"mt-2"}>
              <Input
                id={"shielded-spend-password"}
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
            <div className={`overflow-hidden transition-all duration-200 ${preError ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
              <CopyableError message={preError ?? ''} />
            </div>

            <div className={"mt-4.5 flex gap-2"}>
              <Button type={"button"} onClick={requestClose} variant={"solid"} colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'} size={"md"} className={"flex-1 rounded-[.9375rem]"} disabled={busy}>
                Cancel
              </Button>
              <Button type={"button"} onClick={handleConfirm} disabled={password.length === 0 || busy || !proverReady} variant={"solid"} colorScheme={"lightBlue-mint"} size={"md"} className={"flex-1 rounded-[.9375rem] gap-2"}>
                {busy && <Spinner size={16} />}
                {confirmLabel}
              </Button>
            </div>
          </div>
        )}

        {running && spend && (
          <div className={"phase-fade-in"} key={"progress"}>
            <div className={"mt-5 flex flex-col gap-4 p-[.875rem] rounded-[.9375rem] dash-block"}>
              {PHASES.map((p, i) => {
                const current = phaseIndex(spend.phase)
                const done = i < current
                const active = i === current
                return (
                  <div key={p.key} className={"flex flex-col gap-1.5"}>
                    <div className={"flex items-center gap-2"}>
                      {done
                        ? <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
                        : active
                          ? <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
                          : <div className={"size-3.5 rounded-full border border-dash-primary-dark-blue/20 dark:border-white/20"} />}
                      <Text size={14} weight={"medium"} color={"brand"} opacity={active || done ? 100 : 40}>{p.label}</Text>
                    </div>
                    {active && p.key === ShieldedSpendPhase.Syncing && spend.total > 0 && (
                      <div className={"ml-6 flex flex-col gap-1"}>
                        <div className={"h-2 w-full rounded-full dash-block overflow-hidden"}>
                          <div className={"h-full rounded-full dash-bg-inverse transition-[width] duration-300"} style={{ width: `${Math.min(100, Math.round((spend.fetched / spend.total) * 100))}%` }} />
                        </div>
                        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                          {spend.fetched.toLocaleString('en-US')} / {spend.total.toLocaleString('en-US')}
                        </Text>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <Text size={12} weight={"medium"} color={"brand"} opacity={40} className={"mt-3 block text-center"}>
              This can't be cancelled once the proof is being generated.
            </Text>
          </div>
        )}

        {isError && (
          <div className={"phase-fade-in"} key={"error"}>
            <div className={"mt-5 p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <CopyableError message={spend?.error ?? 'Spend failed.'} />
            </div>
            <div className={"mt-4.5 flex gap-2"}>
              <Button type={"button"} onClick={onClose} variant={"solid"} colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'} size={"md"} className={"flex-1 rounded-[.9375rem]"}>
                Close
              </Button>
              <Button type={"button"} onClick={retry} variant={"solid"} colorScheme={"lightBlue-mint"} size={"md"} className={"flex-1 rounded-[.9375rem]"}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {isDone && (
          <div className={"phase-fade-in"} key={"done"}>
            <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
              <div className={"success-pop"}><SuccessIcon size={56} /></div>
              <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>
                {spend?.identityId ? 'Identity created' : <><CreditsAmount credits={BigInt(sentAmount || amountCredits || '0')} /> sent</>}
              </Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
                {spend?.identityId
                  ? `Funded with ${sentAmount || amountCredits} credits from the pool (minus the Platform fee). Re-sync notes to update your balance.`
                  : 'Broadcast to Platform. Re-sync notes to update your balance.'}
              </Text>
            </div>
            <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              {spend?.identityId && <HashField hash={spend.identityId} label={"Identity"} />}
              {spend?.stHash && <HashField hash={spend.stHash} />}
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
