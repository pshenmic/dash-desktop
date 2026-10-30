import P2pSyncAlert from '@renderer/components/ui/P2pSyncAlert'
import { P2P_SYNC_ALERT_TEXTS } from '@renderer/constants/connection'
import type { SyncGateNoticeProps } from '@renderer/types/P2pSyncAlert'

export default function SyncGateNotice({ className = '' }: SyncGateNoticeProps): React.JSX.Element | null {
  return <P2pSyncAlert description={P2P_SYNC_ALERT_TEXTS.gatedDescription} className={className} />
}
