export interface P2pSyncAlertProps {
  description?: string
  className?: string
}

export type SyncGateNoticeProps = Pick<P2pSyncAlertProps, 'className'>
