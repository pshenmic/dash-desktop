import { Button, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import Alert from '@renderer/components/ui/Alert'
import { SHIELDED_NOTES_ALERT_TEXTS } from '@renderer/constants/shieldedNotesAlert'
import { AlertTone } from '@renderer/enums/AlertTone'
import { useShieldedNotesInfo } from '@renderer/hooks/useShielded'
import type { ShieldedNotesAlertProps } from '@renderer/types/ShieldedNotesAlert'
import { newShieldedNotesTitle } from '@renderer/utils/shieldedNotesAlert'

export default function ShieldedNotesAlert({ walletId, onSync, syncing = false, required = false }: ShieldedNotesAlertProps): React.JSX.Element | null {
  const { info, loading } = useShieldedNotesInfo(walletId ?? undefined)
  const { undecodedCount } = info
  const hasUncheckedNotes = !loading && undecodedCount > 0

  if (!required && !hasUncheckedNotes) return null

  return (
    <Alert
      tone={AlertTone.Info}
      icon={<ShieldSmallIcon size={16} color={"currentColor"} />}
      title={hasUncheckedNotes ? newShieldedNotesTitle(undecodedCount) : SHIELDED_NOTES_ALERT_TEXTS.syncRequired}
      actions={
        <Button
          type={"button"}
          onClick={onSync}
          disabled={syncing}
          variant={"solid"}
          colorScheme={"primary"}
          size={"compact"}
        >
          {syncing ? SHIELDED_NOTES_ALERT_TEXTS.syncing : SHIELDED_NOTES_ALERT_TEXTS.sync}
        </Button>
      }
    />
  )
}
