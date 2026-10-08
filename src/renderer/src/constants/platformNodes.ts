import type {PeerMode} from '@renderer/api/types'
import type {PlatformNodeTableTabDefinition} from '@renderer/types/platformNodes'
import type {ConnectionSwitchPosition} from '@renderer/types/connection'

export const PLATFORM_NODE_MODE_LABELS: Record<PeerMode, string> = {
  dynamic: 'Auto',
  static: 'Static',
}

export const PLATFORM_NODE_SWITCH_POSITIONS: readonly [ConnectionSwitchPosition, ConnectionSwitchPosition] = [
  {label: PLATFORM_NODE_MODE_LABELS.dynamic, ariaLabel: 'Use Auto Platform nodes'},
  {label: PLATFORM_NODE_MODE_LABELS.static, ariaLabel: 'Use Static Platform nodes'},
]

export const PLATFORM_STATIC_NODE_REQUIRED_MESSAGE =
  'Add a static node for this network before enabling Static mode.'

export const PLATFORM_NODE_TABLE_TABS: PlatformNodeTableTabDefinition[] = [
  {value: 'active', label: 'Active'},
  {value: 'static', label: 'Static'},
]

export const PLATFORM_NODE_TABLE_GRID_CLASS_NAME =
  'grid-cols-[minmax(0,1.6fr)_minmax(0,.8fr)_minmax(0,.8fr)_5.5rem]'

export const PLATFORM_NODE_COLUMN_LABELS = ['Nodes', 'Drive Version', 'Block Height', 'Ping Time'] as const

export const ADD_PLATFORM_NODE_PLACEHOLDER = 'Enter HTTPS URL (https://host:port)'

export const PLATFORM_NODE_UNAVAILABLE_LABEL = '—'

export const PLATFORM_NODE_STATE_LABELS = {
  available: 'Available',
  automatic: 'Available automatically',
  noResponse: 'No response',
  saved: 'Saved',
  inactive: 'Not active',
} as const

export const PLATFORM_NODE_EMPTY_LABELS = {
  noWallet: 'Select a wallet to manage Platform nodes.',
  loading: 'Loading Platform nodes…',
  active: 'No active Platform nodes.',
  static: 'No static Platform nodes.',
} as const

export const PLATFORM_NODE_INVALID_URL_MESSAGE = 'Enter a valid HTTPS URL, for example https://node.example.org:1443.'
