import { Button, ShieldSmallIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { useShieldedNotesInfo } from '@renderer/hooks/useShielded'

export default function ShieldedNotesAlert({ walletId, onSync, syncing = false, required = false }: {
  walletId: string | null | undefined
  onSync: () => void
  syncing?: boolean
  required?: boolean
}): React.JSX.Element | null {
  const { info, loading } = useShieldedNotesInfo(walletId ?? undefined)
  const { undecodedCount } = info
  const hasUncheckedNotes = !loading && undecodedCount > 0

  if (!required && !hasUncheckedNotes) return null

  return (
    <div className={"flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] border border-dash-brand/35 bg-dash-brand/8 dark:border-dash-mint/40 dark:bg-dash-mint/10"}>
      <div className={"flex items-center gap-2"}>
        <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
        <Text size={14} weight={"extrabold"} color={"brand"}>
          {hasUncheckedNotes
            ? `${undecodedCount.toLocaleString('en-US')} new note${undecodedCount === 1 ? '' : 's'} in the shielded pool`
            : 'Sync to see unused addresses'}
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
        {syncing ? 'Syncing…' : 'Sync'}
      </Button>
    </div>
  )
}
