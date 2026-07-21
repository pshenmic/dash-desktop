import { Button, ShieldSmallIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { useShieldedNotesInfo } from '@renderer/hooks/useShielded'

export default function ShieldedNotesAlert({ walletId, onSync, syncing = false }: {
  walletId: string | null | undefined
  onSync: () => void
  syncing?: boolean
}): React.JSX.Element | null {
  const { undecodedCount } = useShieldedNotesInfo(walletId ?? undefined)

  if (undecodedCount === 0) return null

  return (
    <div className={"flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] border border-dash-brand/35 bg-dash-brand/8 dark:border-dash-mint/40 dark:bg-dash-mint/10"}>
      <div className={"flex flex-col gap-[.375rem]"}>
        <div className={"flex items-center gap-2"}>
          <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
          <Text size={14} weight={"extrabold"} color={"brand"}>New shielded notes in the network</Text>
        </div>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          {undecodedCount.toLocaleString('en-US')} unchecked note{undecodedCount === 1 ? '' : 's'} appeared in the shielded pool. Check them to bring your balances up to date.
        </Text>
      </div>
      <Button
        type={"button"}
        onClick={onSync}
        disabled={syncing}
        variant={"solid"}
        colorScheme={"primary"}
        size={"sm"}
        className={"min-h-0! py-2! rounded-[.75rem] shrink-0"}
      >
        {syncing ? 'Syncing…' : 'Sync balances'}
      </Button>
    </div>
  )
}
