import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Text, ShieldSmallIcon, CheckIcon, ErrorIcon, Button } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import { useShieldedPoolInfo, useShieldedStatus, useShieldedSyncState } from '@renderer/hooks/useShielded'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { formatCredits, formatCompactCredits } from '@renderer/utils/balance'
import { ShieldedStatus, ShieldedSyncState } from '@renderer/api/types'

function ProverBadge({ status }: { status: ShieldedStatus }): React.JSX.Element {
  if (status.prover === 'ready') {
    return (
      <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-accent-5"}>
        <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />
        <Text size={12} weight={"medium"} color={"blue-mint"}>Ready</Text>
      </div>
    )
  }

  if (status.prover === 'error') {
    return (
      <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-3"}>
        <ErrorIcon size={14} />
        <Text size={12} weight={"medium"} color={"red"}>Preparation failed</Text>
      </div>
    )
  }

  return (
    <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block"}>
      <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Preparing private transactions…</Text>
    </div>
  )
}

function SyncCard({ sync, onSync }: { sync: ShieldedSyncState; onSync: () => void }): React.JSX.Element {
  const running = sync.phase === 'syncing' || sync.phase === 'recovering'
  const pct = sync.phase === 'recovering'
    ? 100
    : sync.total > 0 ? Math.min(100, Math.round((sync.fetched / sync.total) * 100)) : 0

  return (
    <div className={"flex flex-col gap-3 p-5 rounded-[.9375rem] dash-block"}>
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={14} weight={"extrabold"} color={"brand"}>Note sync</Text>
        <Button
          type={"button"}
          onClick={onSync}
          disabled={running}
          variant={"solid"}
          colorScheme={"primary"}
          size={"sm"}
          className={"rounded-[.75rem]"}
        >
          {sync.phase === 'done' ? 'Re-sync' : 'Sync notes'}
        </Button>
      </div>

      {running && (
        <div className={"flex flex-col gap-2"}>
          <div className={"h-2 w-full rounded-full dash-block overflow-hidden"}>
            <div
              className={"h-full rounded-full dash-bg-inverse transition-[width] duration-300"}
              style={{ width: `${pct}%` }}
            />
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={70}>
            {sync.phase === 'recovering'
              ? 'Recovering your notes…'
              : `Syncing notes ${sync.fetched.toLocaleString('en-US')} / ${sync.total.toLocaleString('en-US')}`}
          </Text>
        </div>
      )}

      {!running && sync.phase === 'done' && (() => {
        const unspent = sync.notes.filter((n) => !n.spent).length
        const spentCount = sync.notes.length - unspent
        return (
          <Text size={12} weight={"medium"} color={"brand"} opacity={70}>
            Synced · {unspent.toLocaleString('en-US')} spendable note{unspent === 1 ? '' : 's'}{spentCount > 0 ? ` · ${spentCount.toLocaleString('en-US')} spent` : ''}
          </Text>
        )
      })()}

      {!running && sync.phase === 'error' && (
        <Text size={12} weight={"medium"} color={"red"}>{sync.error ?? 'Sync failed.'}</Text>
      )}

      {!running && sync.phase === 'idle' && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          Unlock with your password to scan the shielded pool for notes addressed to you.
        </Text>
      )}
    </div>
  )
}

export default function ShieldedPage(): React.JSX.Element {
  const { status } = useAuth()
  const navigate = useNavigate()
  const network = status?.network ?? null
  const walletId = status?.selectedWalletId ?? null

  const prover = useShieldedStatus()
  const { poolInfo } = useShieldedPoolInfo(network ?? undefined)
  const { platformAddresses } = usePlatformAddresses(walletId ?? undefined)
  const sync = useShieldedSyncState(walletId)

  const [unlockOpen, setUnlockOpen] = useState(false)

  const transparentCredits = useMemo(
    () => platformAddresses.reduce((sum, a) => sum + BigInt(a.balanceCredits), 0n),
    [platformAddresses],
  )

  const spendableNotes = useMemo(() => sync.notes.filter((note) => !note.spent), [sync.notes])

  const shieldedReady = sync.phase === 'done' && sync.balance !== null
  const shieldedDisplay = shieldedReady ? formatCredits(BigInt(sync.balance as string)) : '—'

  const poolStateDisplay = poolInfo.poolState !== null ? formatCompactCredits(BigInt(poolInfo.poolState)) : null
  const notesCount = poolInfo.notesCount !== null ? BigInt(poolInfo.notesCount).toLocaleString('en-US') : null

  return (
    <div className={"flex flex-col gap-8 px-12 py-10"}>
      <div className={"flex items-end justify-between gap-6"}>
        <div className={"flex flex-col gap-3"}>
          <div className={"flex items-center gap-3"}>
            <ShieldSmallIcon size={28} className={"text-dash-brand dark:text-dash-mint"} />
            <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Shielded</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
            Private Orchard transactions. Move funds between your transparent and shielded balance, where the link between sender and recipient stays hidden.
          </Text>
        </div>
        <ProverBadge status={prover} />
      </div>

      <div className={"flex flex-col gap-4 w-full"}>
        <div className={"flex flex-col gap-4 p-5 rounded-[.9375rem] dash-block-3"}>
          <div className={"flex items-center justify-between"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Transparent</Text>
            <div className={"flex items-baseline gap-1.5"}>
              <Text size={20} weight={"bold"} color={"brand"}>{formatCredits(transparentCredits)}</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>credits</Text>
            </div>
          </div>
          <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
          <div className={"flex items-center justify-between"}>
            <div className={"flex items-center gap-2"}>
              <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Shielded</Text>
            </div>
            <div className={"flex items-baseline gap-1.5"}>
              <Text size={20} weight={"bold"} color={"blue-mint"}>{shieldedDisplay}</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>credits</Text>
            </div>
          </div>
          <div className={"flex items-center justify-between gap-3"}>
            {!shieldedReady ? (
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
                Sync your notes to reveal your shielded balance.
              </Text>
            ) : <span />}
            <Button
              type={"button"}
              onClick={() => navigate('/send?from=platformAddress&to=shielded')}
              variant={"solid"}
              colorScheme={"lightBlue-mint"}
              size={"sm"}
              className={"rounded-[.75rem] shrink-0"}
            >
              Shield funds
            </Button>
          </div>
        </div>

        <SyncCard sync={sync} onSync={() => setUnlockOpen(true)} />

        <div className={"flex flex-col gap-3 p-5 rounded-[.9375rem] dash-block"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Incoming notes</Text>
          {spendableNotes.length === 0 ? (
            <Text size={12} weight={"medium"} color={"brand"} opacity={40}>
              {sync.phase === 'done' ? 'No spendable shielded notes for this wallet yet.' : 'Sync to list your received private notes.'}
            </Text>
          ) : (
            <div className={"flex flex-col"}>
              {spendableNotes.map((note, i) => (
                <div key={note.index} className={i > 0 ? "flex items-center justify-between py-2.5 border-t border-dash-primary-dark-blue/8 dark:border-white/10" : "flex items-center justify-between py-2.5"}>
                  <div className={"flex items-center gap-2"}>
                    <ShieldSmallIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />
                    <Text size={12} weight={"medium"} color={"brand"} opacity={50}>note #{note.index}</Text>
                  </div>
                  <div className={"flex items-baseline gap-1.5"}>
                    <Text size={14} weight={"bold"} color={"brand"}>{formatCredits(BigInt(note.amount))}</Text>
                    <Text size={12} weight={"medium"} color={"brand"} opacity={50}>credits</Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={"flex flex-col gap-3 p-5 rounded-[.9375rem] dash-block"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Shielded pool ({network ?? 'unknown'})</Text>
          <div className={"flex items-center justify-between"}>
            <Text size={14} weight={"medium"} color={"brand"} opacity={70}>Total in pool</Text>
            <Text size={14} weight={"bold"} color={"brand"}>{poolStateDisplay !== null ? `${poolStateDisplay} credits` : '—'}</Text>
          </div>
          <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
          <div className={"flex items-center justify-between"}>
            <Text size={14} weight={"medium"} color={"brand"} opacity={70}>Notes in tree</Text>
            <Text size={14} weight={"bold"} color={"brand"}>{notesCount !== null ? notesCount : '—'}</Text>
          </div>
        </div>
      </div>

      <ShieldedUnlockModal
        isOpen={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        walletId={walletId}
      />
    </div>
  )
}
