import { ConnectionType } from '@renderer/api/types'
import { DATA_SOURCE_LABELS } from '../constants/connection'
import { WalletSyncPhase } from '../enums/WalletSyncPhase'

export interface ConnectionGate {
  actionsGated: boolean
  dataIncomplete: boolean
  dataSourceLabel: string
}

export function connectionGate(desired: ConnectionType, phase: WalletSyncPhase | undefined): ConnectionGate {
  if (desired !== 'p2p') {
    return { actionsGated: false, dataIncomplete: false, dataSourceLabel: DATA_SOURCE_LABELS.rpc }
  }

  const syncing = phase !== WalletSyncPhase.Synced

  return {
    actionsGated: syncing,
    dataIncomplete: syncing,
    dataSourceLabel: syncing ? DATA_SOURCE_LABELS.p2pSyncing : DATA_SOURCE_LABELS.p2p,
  }
}
