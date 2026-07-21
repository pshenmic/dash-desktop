import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, ArrowIcon, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import { dashboardPage } from '@renderer/constants'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useShieldedPoolInfo, useShieldedStatus, useShieldedSyncState } from '@renderer/hooks/useShielded'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import { ShieldedProverState } from '@renderer/enums/ShieldedProverState'
import { formatCompactCredits } from '@renderer/utils/balance'

export default function ShieldedCard(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? undefined

  const sync = useShieldedSyncState(walletId)
  const { poolInfo } = useShieldedPoolInfo(network)
  const prover = useShieldedStatus()
  const { isBalanceVisible } = useBalanceVisibility()
  const labels = dashboardPage.shielded

  const [syncOpen, setSyncOpen] = useState(false)
  const spendableNotes = useMemo(() => sync.notes.filter((n) => !n.spent).length, [sync.notes])
  const shieldedReady = sync.phase === ShieldedSyncPhase.Done && sync.balance !== null
  const syncRunning = sync.phase === ShieldedSyncPhase.Syncing || sync.phase === ShieldedSyncPhase.Recovering
  const blur = isBalanceVisible ? '' : 'blur-sm select-none pointer-events-none'

  const meta: React.ReactNode[] = []
  if (shieldedReady) {
    meta.push(`${spendableNotes.toLocaleString('en-US')} ${labels.spendableNotes}`)
    if (poolInfo.poolState !== null) {
      meta.push(`${labels.pool} ${formatCompactCredits(BigInt(poolInfo.poolState))} ${labels.credits}`)
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

      <div className={"flex flex-col gap-1"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
          {labels.balance}
        </Text>
        {shieldedReady ? (
          <Text size={20} weight={"extrabold"} color={"blue-mint"} className={`leading-[140%] ${blur}`}>
            <CreditsAmount credits={BigInt(sync.balance as string)} compact />
          </Text>
        ) : syncRunning ? (
          <Text size={20} weight={"extrabold"} color={"blue-mint"} className={"leading-[140%]"}>Syncing…</Text>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSyncOpen(true)
            }}
            className={"self-start cursor-pointer hover:opacity-80 transition-opacity duration-200"}
          >
            <Text size={20} weight={"extrabold"} color={"blue-mint"} className={"leading-[140%]"}>Sync balances</Text>
          </button>
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
        walletId={walletId}
      />
    </div>
  )
}
