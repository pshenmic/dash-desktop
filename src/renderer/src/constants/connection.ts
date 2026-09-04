import { ConnectionStatus, ConnectionType, WalletSyncPhase } from '@renderer/api/types'
import type {
  ConnectionSelectOption,
  ConnectionSettingsTabDefinition,
  PeerTableRow,
  PeerTableTab,
  PeerTableTabDefinition,
} from '@renderer/types/connection'

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  p2p: 'Dash P2P',
  rpc: 'Dashscan API',
}

export const CONNECTION_STATUS_DISPLAY: Record<ConnectionStatus, {
  label: string
  textColor: string
  shadowColor: string
}> = {
  connecting: {
    label: 'Connecting',
    textColor: 'text-dash-orange!',
    shadowColor: 'var(--color-dash-orange)',
  },
  online: {
    label: 'Online',
    textColor: 'text-dash-mint!',
    shadowColor: 'var(--color-dash-mint)',
  },
  unavailable: {
    label: 'Unavailable',
    textColor: 'text-dash-orange!',
    shadowColor: 'var(--color-dash-orange)',
  },
  synced: {
    label: 'Synced',
    textColor: 'text-dash-mint!',
    shadowColor: 'var(--color-dash-mint)',
  },
  syncing: {
    label: 'Syncing',
    textColor: 'text-dash-orange!',
    shadowColor: 'var(--color-dash-orange)',
  },
  'sync-stopped': {
    label: 'Sync stopped',
    textColor: 'text-dash-orange!',
    shadowColor: 'var(--color-dash-orange)',
  },
}

export const SYNC_ACTION_LABELS = {
  start: 'Start sync',
  stop: 'Stop sync',
} as const

export const WALLET_SYNC_PHASE_LABELS: Record<WalletSyncPhase, string> = {
  [WalletSyncPhase.Idle]: 'Idle',
  [WalletSyncPhase.Connecting]: 'Connecting',
  [WalletSyncPhase.SyncingHeaders]: 'Syncing headers',
  [WalletSyncPhase.SyncedHeaders]: 'Headers synchronized',
  [WalletSyncPhase.SyncingCfcheckpt]: 'Syncing filter checkpoints',
  [WalletSyncPhase.SyncingCfheaders]: 'Syncing filter headers',
  [WalletSyncPhase.SyncingCfilters]: 'Scanning wallet data',
  [WalletSyncPhase.Synced]: 'Synced',
  [WalletSyncPhase.Stopped]: 'Stopped',
}

export const REFRESH_DATA_LABEL = 'Refresh data'

export const REFRESH_FAILED_MESSAGE = '**Refresh incomplete** Some data could not be refreshed.'

export const RPC_CONNECTION_NAME = 'dashscan.io'

export const CONNECTION_SETTINGS_TABS: ConnectionSettingsTabDefinition[] = [
  {value: 'core', label: 'Core'},
  {value: 'platform', label: 'Platform'},
]

export const CONNECTION_SETTINGS_DESCRIPTION =
  'Here you can change your connection settings with flexible options. Turning on RPC and P2P Modes for Core at the same time will result in synchronization with both of those options. (You can use wallet while P2P data synchronizes)'

export const CORE_CONNECTION_MODE_LABELS: Record<ConnectionType, string> = {
  p2p: 'P2P',
  rpc: 'RPC',
}

export const CORE_CONNECTION_MODE_OPTIONS: ConnectionType[] = ['p2p', 'rpc']

export const RPC_CONNECTION_OPTIONS: ConnectionSelectOption[] = [
  {value: RPC_CONNECTION_NAME, label: RPC_CONNECTION_NAME},
]

export const PLATFORM_EXPLORER_CONNECTION_NAME = 'platform-explorer.pshenmic.dev'

export const PLATFORM_EXPLORER_CONNECTION_OPTIONS: ConnectionSelectOption[] = [
  {value: PLATFORM_EXPLORER_CONNECTION_NAME, label: PLATFORM_EXPLORER_CONNECTION_NAME},
]

export const PEER_TABLE_TABS: PeerTableTabDefinition[] = [
  {value: 'active', label: 'Active'},
  {value: 'banned', label: 'Banned'},
  {value: 'static', label: 'Static'},
]

export const PEER_TABLE_ROWS: Record<PeerTableTab, PeerTableRow[]> = {
  active: [
    {id: 'active-159-200-54-78-a', peer: '159.200.54.78:9999', userAgent: '/Dash Core:23.0.2/', pingTime: '163 ms'},
    {id: 'active-159-200-54-78-b', peer: '159.200.54.78:9999', userAgent: '/Dash Core:23.0.2/', pingTime: '578 ms'},
    {id: 'active-188-50-341-5', peer: '188.50.341.5:9999', userAgent: '/Dash Core:23.1.2/', pingTime: '91 ms'},
  ],
  banned: [],
  static: [],
}

export const PEER_TABLE_ACTION_LABELS: Record<PeerTableTab, string> = {
  active: 'Add Peer',
  banned: 'Ban Peer',
  static: 'Add Peer',
}

export const PEER_ACTION_MENU_TITLE = 'Peer Actions'

export const PEER_ACTION_LABELS = {
  ban: 'Ban Peer',
  addStatic: 'Add to Static List',
} as const

export const ADD_PEER_PLACEHOLDER = 'Enter IP:Port'

export const PEER_TABLE_EMPTY_LABEL = 'No peers in this list.'

export const PLATFORM_ROW_LABELS = {
  dapi: 'Enable GRPC',
  explorer: 'Enable Platform Explorer API',
} as const

export const CONNECTION_SETTINGS_TOOLTIPS = {
  general:
    'Choose whether the wallet displays Core data from Dashscan RPC or locally synchronized P2P data.',
  p2p:
    'P2P synchronization downloads wallet data in the background. It can keep running in parallel while RPC remains the wallet display source.',
  rpc:
    'RPC supplies the wallet data shown in the app when RPC mode is selected. Background P2P synchronization can remain enabled at the same time.',
  peers:
    'View active, banned, and static P2P peers. Peer management and static peers are visual controls only for now.',
  dapi:
    'DAPI is used to query decentralized Platform data, including balances and documents. This switch is visual only for now.',
  platformExplorer:
    'Platform Explorer supplies Platform queries that are not available through DAPI, such as Platform transaction lookups. These controls are visual only for now.',
} as const

export const SYNC_PROGRESS_COMPLETE_HOLD_MS = 500

export const SYNC_PROGRESS_FADE_MS = 300
