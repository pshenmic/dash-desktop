import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Text, ArrowIcon, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import Spinner from '@renderer/components/ui/Spinner'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import { dashboardPage } from '@renderer/constants'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useShieldedNotesInfo, useShieldedPoolInfo, useShieldedStatus, useShieldedSyncState } from '@renderer/hooks/useShielded'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import { ShieldedProverState } from '@renderer/enums/ShieldedProverState'

export default function ShieldedCard(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? undefined

  const sync = useShieldedSyncState(walletId)
  const { poolInfo } = useShieldedPoolInfo(network)
  const { info: notesInfo, loading: notesLoading } = useShieldedNotesInfo(walletId ?? undefined)
  const prover = useShieldedStatus()
  const { isBalanceVisible } = useBalanceVisibility()
  const labels = dashboardPage.shielded

  const [syncOpen, setSyncOpen] = useState(false)
  const [syncStarting, setSyncStarting] = useState(false)
  const spendableNotes = useMemo(() => sync.notes.filter((n) => !n.spent).length, [sync.notes])
  const shieldedReady = sync.phase === ShieldedSyncPhase.Done && sync.balance !== null
  const syncRunning = sync.phase === ShieldedSyncPhase.Syncing || sync.phase === ShieldedSyncPhase.Recovering
  const syncBusy = syncStarting || syncRunning
  const blur = isBalanceVisible ? '' : 'blur-sm select-none pointer-events-none'

  useEffect(() => {
    setSyncStarting(false)
  }, [sync.phase, sync.syncedAt])

  const meta: React.ReactNode[] = []
  if (shieldedReady) {
    meta.push(`${spendableNotes.toLocaleString('en-US')} ${labels.spendableNotes}`)
    if (poolInfo.poolState !== null) {
      meta.push(<span key={"pool"}>{labels.pool} <CreditsAmount credits={BigInt(poolInfo.poolState)} compact showFiat={false} unit={labels.credits} /></span>)
    }
  }
  if (poolInfo.notesCount !== null) {
    meta.push(`${BigInt(poolInfo.notesCount).toLocaleString('en-US')} ${labels.notesInTree}`)
  }
  if (prover.prover === ShieldedProverState.Error) {
    meta.push(<span key={"prover"} className={"text-dash-red"}>{labels.proverError}</span>)
  } else if (prover.prover !== ShieldedProverState.Ready) {
    meta.push(<span key={"prover"} className={"text-dash-orange"}>{labels.proverPreparing}</span>)
  }

  return (
    <div
      onClick={() => navigate('/addresses?tab=shielded')}
      className={"relative overflow-hidden flex flex-col gap-3 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_0_rgba(12,28,51,0.14)] cursor-pointer"}
    >
      <div className={"absolute -top-14 -right-8 size-36 rounded-full bg-dash-brand/8 dark:bg-dash-mint/6 blur-3xl pointer-events-none"} />
      <div className={"relative flex items-center justify-between"}>
        <div className={"flex items-center gap-2.5"}>
          <span className={"flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12 dash-text-primary"}>
            <ShieldSmallIcon size={15} color={"currentColor"} />
          </span>
          <Text size={14} weight={"medium"} color={"brand"}>
            {labels.title}
          </Text>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate('/addresses?tab=shielded')
          }}
          className={"group flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity duration-200"}
        >
          <Text size={12} weight={"medium"} color={"blue-mint"}>
            {labels.open}
          </Text>
          <ArrowIcon size={9} className={"dash-text-primary rotate-180 transition-transform duration-200 group-hover:translate-x-0.5"} color={"currentColor"} />
        </button>
      </div>

      <div className={"flex items-end justify-between gap-3"}>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
            {labels.balance}
          </Text>
          {shieldedReady ? (
            <Text size={20} weight={"extrabold"} color={"blue-mint"} className={`leading-[140%] ${blur}`}>
              <CreditsAmount credits={BigInt(sync.balance as string)} compact />
            </Text>
          ) : syncBusy ? (
            <div className={"flex items-center gap-2"}>
              <Spinner size={16} className={"text-dash-brand dark:text-dash-mint"} />
              <Text size={20} weight={"extrabold"} color={"blue-mint"} className={"leading-[140%]"}>{labels.syncing}</Text>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSyncOpen(true)
              }}
              className={"self-start cursor-pointer hover:opacity-80 transition-opacity duration-200"}
            >
              <Text size={20} weight={"extrabold"} color={"blue-mint"} className={"leading-[140%]"}>{labels.syncBalances}</Text>
            </button>
          )}
        </div>
        {shieldedReady && (syncBusy || (notesInfo.undecodedCount > 0 && !notesLoading)) && (
          <Button
            type={"button"}
            onClick={(e) => {
              e.stopPropagation()
              setSyncOpen(true)
            }}
            disabled={syncBusy}
            variant={"solid"}
            colorScheme={"primary"}
            size={"sm"}
            className={"min-h-0! py-2! rounded-[.75rem] shrink-0 gap-2"}
          >
            {syncBusy && <Spinner size={14} />}
            {syncBusy ? labels.syncing : labels.syncBalances}
          </Button>
        )}
      </div>

      {meta.length > 0 && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[150%]"}>
          {meta.map((part, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {part}
            </span>
          ))}
        </Text>
      )}

      <ShieldedUnlockModal
        isOpen={syncOpen}
        onClose={() => setSyncOpen(false)}
        onStarted={() => setSyncStarting(true)}
        walletId={walletId}
      />
    </div>
  )
}
