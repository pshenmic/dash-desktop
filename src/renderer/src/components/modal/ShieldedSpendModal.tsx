import { useEffect, useRef, useState } from 'react'
import { Text, SuccessIcon, CheckIcon } from '../dash-ui-kit-enxtended'
import { ExclamationIcon } from '../dash-ui-kit-enxtended/icons'
import HashField from '@renderer/components/ui/HashField'
import CopyableError from '@renderer/components/ui/CopyableError'
import PasswordField from '@renderer/components/ui/PasswordField'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import RecipientSummary from '@renderer/components/ui/RecipientSummary'
import TxSummary from '@renderer/components/ui/TxSummary'
import { useAuth } from '@renderer/contexts/AuthContext'
import { API } from '@renderer/api'
import { PlatformRecipient, ShieldedSpendState } from '@renderer/api/types'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import { ShieldedSpendPhase } from '@renderer/enums/ShieldedSpendPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import Spinner from '@renderer/components/ui/Spinner'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import { INVALID_WALLET_PASSWORD_MESSAGE, SHIELDED_SPEND_POLL_MS, SHIELDED_SPEND_RETRY_MS } from '@renderer/constants'
import { shieldedSpendSummaryCosts } from '@renderer/utils/txSummaryCosts'
import { shieldedSpendEndpoints } from '@renderer/utils/txSummaryEndpoints'
import type { ShieldedSpendModalProps } from '@renderer/types/ShieldedSpendModal'

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
  advanced = true,
  onClose,
  walletId,
  title,
  kind,
  from,
  toValue,
  amountCredits,
  feeCredits,
  recipients,
  proverReady,
  start,
  sourceValid = true,
  onSuccess,
  successNote,
}: ShieldedSpendModalProps): React.JSX.Element {
  const sourceValidRef = useRef(sourceValid)
  sourceValidRef.current = sourceValid
  const { status } = useAuth()
  const network = status?.network ?? null
  const [password, setPassword] = useState('')
  const [preError, setPreError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(false)
  const [spend, setSpend] = useState<ShieldedSpendState | null>(null)
  const [sentAmount, setSentAmount] = useState<bigint | null>(null)
  const [sentRecipients, setSentRecipients] = useState<PlatformRecipient[] | null>(null)
  const notified = useRef(false)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPreError(null)
      setBusy(false)
      setStarted(false)
      setSpend(null)
      setSentAmount(null)
      setSentRecipients(null)
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

  const running = started && spend != null && spend.phase !== ShieldedSpendPhase.Done && spend.phase !== ShieldedSpendPhase.Error

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy || !proverReady || started || !sourceValidRef.current) return
    setBusy(true)
    setPreError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setPreError(INVALID_WALLET_PASSWORD_MESSAGE)
        setBusy(false)
        return
      }
      if (!sourceValidRef.current) {
        setBusy(false)
        return
      }
      setSentAmount(amountCredits)
      setSentRecipients(recipients?.map(recipient => ({ ...recipient })) ?? null)
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
    if (running || busy) return
    onClose()
  }

  const isDone = spend?.phase === ShieldedSpendPhase.Done
  const isError = started && spend?.phase === ShieldedSpendPhase.Error
  const sentCredits = sentAmount ?? amountCredits
  const costs = shieldedSpendSummaryCosts(kind, amountCredits, feeCredits)
  let confirmLabel = advanced ? 'Sign & Send' : 'Confirm'
  if (busy) confirmLabel = 'Starting…'
  else if (!proverReady) confirmLabel = 'Preparing…'
  let modalTitle = title
  if (isDone) modalTitle = spend?.identityId ? 'Identity created' : 'Sent privately'

  return (
    <Modal open={isOpen} onClose={requestClose} title={modalTitle} size={ModalSize.Lg} dismissible={!running && !busy}>
      {!started && (
        <div className={"phase-fade-in"} key={"confirm"}>
          <TxSummary
            unit={"credits"}
            amount={amountCredits}
            from={from}
            to={shieldedSpendEndpoints(kind, toValue, recipients)}
            fees={costs.fees}
            total={costs.total}
            details={costs.details}
            className={"mt-4"}
          />

          <PasswordField
            id={"shielded-spend-password"}
            value={password}
            onChange={(value) => { setPreError(null); setPassword(value) }}
            onSubmit={handleConfirm}
            error={preError}
            disabled={busy}
            hint={"Syncing and proving can take a little while."}
            className={"mt-5"}
          />

          <ModalActions
            secondary={{ label: 'Cancel', onClick: requestClose, disabled: busy }}
            primary={{
              label: confirmLabel,
              onClick: handleConfirm,
              disabled: password.length === 0 || !proverReady || !sourceValid,
              loading: busy,
            }}
          />
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
                    {done && <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />}
                    {!done && active && <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />}
                    {!done && !active && <div className={"size-3.5 rounded-full border border-dash-primary-dark-blue/20 dark:border-white/20"} />}
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
          <ModalActions
            secondary={{ label: 'Close', onClick: onClose }}
            primary={{ label: 'Try again', onClick: retry }}
          />
        </div>
      )}

      {isDone && (
        <div className={"phase-fade-in"} key={"done"}>
          <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
            <div className={"success-pop"}><SuccessIcon size={56} /></div>
            <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>
              {spend?.identityId ? 'Identity created' : <CreditsAmount credits={sentCredits} align={"center"} />}
            </Text>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
              {spend?.identityId
                ? <>Funded with <CreditsAmount credits={sentCredits} showFiat={false} /> from the pool (minus the Platform fee). Re-sync notes to update your balance.</>
                : 'Broadcast to Platform. Re-sync notes to update your balance.'}
            </Text>
            {successNote && (
              <div className={"mt-3 flex items-start gap-2 w-full p-[.875rem] rounded-[.9375rem] border border-dash-orange/40 bg-dash-orange/8 dark:bg-dash-orange/10 text-left"}>
                <ExclamationIcon size={16} className={"text-dash-orange shrink-0"} />
                <Text size={12} weight={"medium"} className={"leading-[130%] text-dash-orange!"}>
                  {successNote}
                </Text>
              </div>
            )}
          </div>
          <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
            {sentRecipients && <RecipientSummary recipients={sentRecipients} />}
            {spend?.identityId && <HashField hash={spend.identityId} label={"Identity"} />}
            {spend?.stHash && <HashField hash={spend.stHash} explorerUrl={network ? platformTransactionUrl(spend.stHash, network) : null} />}
          </div>
          <ModalActions primary={{ label: 'Done', onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
