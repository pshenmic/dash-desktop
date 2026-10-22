import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Identifier } from 'dash-ui-kit/react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Text, ShieldSmallIcon, Button } from '@renderer/components/dash-ui-kit-enxtended'
import PageHeader from '@renderer/components/ui/PageHeader'
import CopyButton from '@renderer/components/ui/CopyButton'
import ProverPill from '@renderer/components/pages/shielded/ProverPill'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import { groupShieldedNotesByAddress } from '@renderer/utils/shieldedBalances'
import { truncateShieldedAddress } from '@renderer/utils/shieldedAddress'
import { useShieldedPoolInfo, useShieldedStatus, useShieldedSyncState } from '@renderer/hooks/useShielded'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import { ShieldedSyncState } from '@renderer/api/types'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import { shieldedPage } from '@renderer/constants/shieldedPage'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SURFACE_PANEL, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { PROGRESS_FILL, PROGRESS_TRACK } from '@renderer/constants/progressBar'
import { ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'

function SyncCard({ sync, onSync }: { sync: ShieldedSyncState; onSync: () => void }): React.JSX.Element {
  const running = sync.phase === ShieldedSyncPhase.Syncing || sync.phase === ShieldedSyncPhase.Recovering
  const pct = sync.phase === ShieldedSyncPhase.Recovering
    ? 100
    : sync.total > 0 ? Math.min(100, Math.round((sync.fetched / sync.total) * 100)) : 0

  return (
    <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={14} weight={"extrabold"} color={"brand"}>Note sync</Text>
        <Button
          type={"button"}
          onClick={onSync}
          disabled={running}
          variant={"solid"}
          colorScheme={"primary"}
          size={"compact"}
        >
          {running ? shieldedPage.syncing : shieldedPage.sync}
        </Button>
      </div>

      {running && (
        <div className={"flex flex-col gap-2"}>
          <div className={PROGRESS_TRACK}>
            <div
              className={PROGRESS_FILL}
              style={{ width: `${pct}%` }}
            />
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            {sync.phase === ShieldedSyncPhase.Recovering
              ? 'Recovering your notes…'
              : `Syncing notes ${sync.fetched.toLocaleString('en-US')} / ${sync.total.toLocaleString('en-US')}`}
          </Text>
        </div>
      )}

      {!running && sync.phase === ShieldedSyncPhase.Done && (() => {
        const unspent = sync.notes.filter((n) => !n.spent).length
        const spentCount = sync.notes.length - unspent
        return (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            Synced · {unspent.toLocaleString('en-US')} spendable note{unspent === 1 ? '' : 's'}{spentCount > 0 ? ` · ${spentCount.toLocaleString('en-US')} spent` : ''}
          </Text>
        )
      })()}

      {!running && sync.phase === ShieldedSyncPhase.Error && (
        <Text size={12} weight={"medium"} color={"red"}>{sync.error ?? 'Sync failed.'}</Text>
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
    () => platformAddresses.reduce((sum, a) => sum + a.balanceCredits, 0n),
    [platformAddresses],
  )

  const spendableGroups = useMemo(() => groupShieldedNotesByAddress(sync.notes), [sync.notes])

  const shieldedReady = sync.phase === ShieldedSyncPhase.Done && sync.balance !== null
  const syncRunning = sync.phase === ShieldedSyncPhase.Syncing || sync.phase === ShieldedSyncPhase.Recovering

  const notesCount = poolInfo.notesCount !== null ? poolInfo.notesCount.toLocaleString('en-US') : null

  return (
    <div className={"flex flex-col px-12 pb-10"}>
      <PageHeader
        title={PAGE_HEADERS.shielded.title}
        subtitle={PAGE_HEADERS.shielded.subtitle}
        icon={<ShieldSmallIcon size={24} className={"text-dash-brand dark:text-dash-mint"} />}
        actions={<ProverPill status={prover} />}
      />

      <div className={`flex w-full flex-col gap-[.625rem] ${SURFACE_PANEL}`}>
        <div className={`flex flex-col gap-4 ${SURFACE_SECTION}`}>
          <div className={"flex items-center justify-between"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Transparent</Text>
            <Text size={20} weight={"bold"} color={"brand"}>
              <CreditsAmount credits={transparentCredits} align={"end"} unitClassName={"text-[.75rem] font-medium text-dash-primary-dark-blue/50 dark:text-white/50"} />
            </Text>
          </div>
          <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
          <div className={"flex items-center justify-between"}>
            <div className={"flex items-center gap-2"}>
              <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Shielded</Text>
            </div>
            {shieldedReady ? (
              <Text size={20} weight={"bold"} color={"blue-mint"}>
                <CreditsAmount credits={sync.balance ?? 0n} align={"end"} unitClassName={"text-[.75rem] font-medium text-dash-primary-dark-blue/50 dark:text-white/50"} />
              </Text>
            ) : (
              <button
                type={"button"}
                onClick={() => setUnlockOpen(true)}
                disabled={syncRunning}
                className={"flex items-baseline gap-1.5 cursor-pointer hover:opacity-80 transition-opacity duration-200 disabled:cursor-default disabled:opacity-50"}
              >
                <Text size={20} weight={"bold"} color={"blue-mint"}>—</Text>
                <Text size={12} weight={"bold"} color={"blue-mint"}>{shieldedPage.syncNotes}</Text>
              </button>
            )}
          </div>
          <div className={"flex items-center justify-end gap-3"}>
            <Button
              type={"button"}
              onClick={() => navigate('/send?from=platformAddress&to=shielded')}
              variant={"solid"}
              colorScheme={"lightBlue-mint"}
              size={"compact"}
              className={"shrink-0"}
            >
              Shield funds
            </Button>
          </div>
        </div>

        <SyncCard sync={sync} onSync={() => setUnlockOpen(true)} />

        {(sync.phase === ShieldedSyncPhase.Done || spendableGroups.length > 0) && <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Incoming notes</Text>
          {spendableGroups.length === 0 ? (
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
              {shieldedPage.noNotes}
            </Text>
          ) : (
            <div className={"flex flex-col gap-4"}>
              {spendableGroups.map((group) => (
                <div key={group.address} className={"flex flex-col gap-1"}>
                  <div className={"flex items-center justify-between gap-3"}>
                    <div className={"flex items-center gap-2 min-w-0"}>
                      <ShieldSmallIcon size={14} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
                      <Identifier highlight={"both"} linesAdjustment={false} className={ADDRESS_ROW_IDENTIFIER_CLASS}>{truncateShieldedAddress(group.address)}</Identifier>
                      <CopyButton text={group.address} />
                      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>· {group.notes.length} note{group.notes.length === 1 ? '' : 's'}</Text>
                    </div>
                    <Text size={14} weight={"bold"} color={"brand"}>
                      <CreditsAmount credits={group.total} align={"end"} unitClassName={"text-[.75rem] font-medium text-dash-primary-dark-blue/50 dark:text-white/50"} />
                    </Text>
                  </div>
                  <div className={"flex flex-col pl-[1.375rem]"}>
                    {group.notes.map((note, i) => (
                      <div key={note.index} className={i > 0 ? "flex items-center justify-between py-1.5 border-t border-dash-primary-dark-blue/8 dark:border-white/10" : "flex items-center justify-between py-1.5"}>
                        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>note #{note.index}</Text>
                        <Text size={12} weight={"medium"} color={"brand"}>
                          <CreditsAmount credits={BigInt(note.amount)} align={"end"} unitClassName={"text-[.75rem] font-medium text-dash-primary-dark-blue/50 dark:text-white/50"} />
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>}

        <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Shielded pool ({network ?? 'unknown'})</Text>
          <div className={"flex items-center justify-between"}>
            <Text size={14} weight={"medium"} color={"brand"} opacity={50}>Total in pool</Text>
            <Text size={14} weight={"bold"} color={"brand"}>
              {poolInfo.poolState !== null ? <CreditsAmount credits={BigInt(poolInfo.poolState)} compact align={"end"} /> : '—'}
            </Text>
          </div>
          <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
          <div className={"flex items-center justify-between"}>
            <Text size={14} weight={"medium"} color={"brand"} opacity={50}>Notes in tree</Text>
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
