import {useEffect, useMemo, useState} from 'react'
import {
  AddIcon,
  Button,
  CheckmarkIcon,
  CloseIcon,
  DeleteIcon,
  InfoTooltip,
  Text,
  TurnOffIcon,
} from '@renderer/components/dash-ui-kit-enxtended'
import ContextMenu, {type ContextMenuItem} from '@renderer/components/ui/ContextMenu'
import DropdownField from '@renderer/components/ui/DropdownField'
import Spinner from '@renderer/components/ui/Spinner'
import {useAuth} from '@renderer/contexts/AuthContext'
import {useConnectionModeContext} from '@renderer/contexts/ConnectionModeContext'
import {
  ADD_PEER_PLACEHOLDER,
  BANNED_PEER_STATUS_LABEL,
  CONNECTION_SETTINGS_TOOLTIPS,
  CORE_CONNECTION_MODE_LABELS,
  CORE_CONNECTION_MODE_OPTIONS,
  DYNAMIC_PEER_ADDED_MESSAGE,
  DYNAMIC_PEER_ALREADY_ADDED_MESSAGE,
  DYNAMIC_PEER_MODE_ENABLED_MESSAGE,
  PEER_ACTION_LABELS,
  PEER_ACTION_MENU_TITLE,
  PEER_ALREADY_BANNED_MESSAGE,
  PEER_BANNED_MESSAGE,
  PEER_CHECKING_LABEL,
  PEER_REMOVED_MESSAGE,
  PEER_SAVING_LABEL,
  PEER_TABLE_COLUMN_LABELS,
  PEER_TABLE_GRID_CLASS_NAMES,
  PEER_TABLE_ACTION_LABELS,
  PEER_TABLE_TABS,
  PEER_UNBANNED_MESSAGE,
  PEER_UNAVAILABLE_LABEL,
  RPC_CONNECTION_NAME,
  RPC_CONNECTION_OPTIONS,
  STATIC_PEER_ADDED_MESSAGE,
  STATIC_PEER_ALREADY_ADDED_MESSAGE,
  STATIC_PEER_MODE_ENABLED_MESSAGE,
  STATIC_PEER_READY_MESSAGE,
  STATIC_PEER_REQUIRED_MESSAGE,
  STATIC_PEER_STATE_DISPLAY,
} from '@renderer/constants/connection'
import {WalletSyncPhase, type PeerMode} from '@renderer/api/types'
import {API} from '@renderer/api'
import {toast} from '@renderer/components/ui/Toast'
import {isWalletSyncInactive} from '@renderer/utils/walletSync'
import {getErrorMessage} from '@renderer/utils/error'
import {setWalletSyncEnabled} from '@renderer/utils/connectionSettings'
import {usePeerSettings} from '@renderer/hooks/usePeerSettings'
import {buildPeerTableRows, getPeerEmptyState} from '@renderer/utils/peers'
import type {
  PeerRowAction,
  PeerTableRow,
  PeerTableTab,
  WalletConnectionMode,
  WalletSyncAction,
} from '@renderer/types/connection'

function SectionTitle({
  label,
  tooltip,
  className = '',
}: {
  label: string
  tooltip: string
  className?: string
}): React.JSX.Element {
  return (
    <div className={`mb-3 flex items-center gap-2 ${className}`}>
      <Text as="h2" size={14} weight="medium" color="brand" opacity={50}>
        {label}
      </Text>
      <InfoTooltip content={tooltip} />
    </div>
  )
}

function SwitchControl({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`
        flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors
        disabled:cursor-wait disabled:opacity-60
        ${checked
          ? 'justify-end bg-dash-brand/30 dark:bg-dash-mint/25'
          : 'justify-start bg-dash-primary-dark-blue/15 dark:bg-white/15'}
      `}
    >
      <span
        className={`
          size-6 rounded-full shadow-sm transition-colors
          ${checked ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-white'}
        `}
      />
    </button>
  )
}

function SettingsRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-[3.75rem] items-center justify-between gap-5 rounded-[1.25rem] dash-block px-4 py-3 sm:px-5">
      <Text size={14} weight="medium" color="brand" className="min-w-0">
        {label}
      </Text>
      {children}
    </div>
  )
}

function WalletConnectionSelector({
  desired,
  ready,
  setDesired,
}: {
  desired: WalletConnectionMode
  ready: boolean
  setDesired: (next: WalletConnectionMode) => void
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="Wallet connection mode"
      className="relative grid h-10 w-[3.25rem] shrink-0 grid-cols-2"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-6 rounded-full bg-dash-primary-dark-blue/15 dark:bg-white/15"
      >
        <span
          className={`
            block size-6 rounded-full bg-dash-brand shadow-sm transition-transform dark:bg-dash-mint
            ${desired === 'rpc' ? 'translate-x-7' : 'translate-x-0'}
          `}
        />
      </div>
      {CORE_CONNECTION_MODE_OPTIONS.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-label={`Use ${CORE_CONNECTION_MODE_LABELS[mode]} mode`}
          aria-checked={desired === mode}
          disabled={!ready}
          onClick={() => desired !== mode && setDesired(mode)}
          className={`
            relative z-10 flex cursor-pointer items-start justify-center text-[9px] font-medium leading-none
            disabled:cursor-wait disabled:opacity-60
            ${desired === mode
              ? 'text-dash-brand dark:text-dash-mint'
              : 'text-dash-primary-dark-blue/45 dark:text-white/45'}
          `}
        >
          {CORE_CONNECTION_MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  )
}

function AddPeerForm({
  pendingLabel,
  tab,
  onClose,
  onSubmit,
}: {
  pendingLabel: string
  tab: PeerTableTab
  onClose: () => void
  onSubmit: (peer: string) => Promise<void>
}): React.JSX.Element {
  const [peer, setPeer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    const trimmed = peer.trim()
    if (trimmed.length === 0 || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(trimmed)
      onClose()
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className={`grid min-h-[3.625rem] ${PEER_TABLE_GRID_CLASS_NAMES[tab]} items-center gap-3 border-t border-dash-primary-dark-blue/10 px-4 dark:border-white/10`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="text"
          aria-label="Peer address"
          placeholder={ADD_PEER_PLACEHOLDER}
          value={peer}
          disabled={submitting}
          autoFocus
          onChange={event => setPeer(event.target.value)}
          className="h-11 min-w-0 flex-1 rounded-[.75rem] bg-dash-primary-dark-blue/5 px-4 text-sm font-medium text-dash-primary-dark-blue outline-none placeholder:text-dash-primary-dark-blue/35 focus:ring-2 focus:ring-dash-brand/25 dark:bg-white/8 dark:text-white dark:placeholder:text-white/35 dark:focus:ring-dash-mint/25"
        />
        <button
          type="submit"
          aria-label={submitting ? pendingLabel : 'Confirm peer'}
          disabled={submitting || peer.trim().length === 0}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[.5rem] bg-dash-mint/20 text-dash-mint hover:bg-dash-mint/30 disabled:cursor-wait disabled:opacity-50"
        >
          <CheckmarkIcon size={12} color="currentColor" />
        </button>
        <button
          type="button"
          aria-label="Close peer form"
          disabled={submitting}
          onClick={onClose}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[.5rem] bg-dash-primary-dark-blue/8 text-dash-primary-dark-blue/45 hover:bg-dash-primary-dark-blue/12 disabled:cursor-wait disabled:opacity-50 dark:bg-white/10 dark:text-white/45 dark:hover:bg-white/15"
        >
          <CloseIcon size={10} color="currentColor" />
        </button>
      </div>
      <div aria-live="polite" className="truncate">
        <Text as="p" size={12} weight="medium" color="brand" className="truncate">
          {submitting ? pendingLabel : ''}
        </Text>
      </div>
    </form>
  )
}

function PeerRow({
  configuredMode,
  disabled,
  row,
  tab,
  onAction,
}: {
  configuredMode: PeerMode | null
  disabled: boolean
  row: PeerTableRow
  tab: PeerTableTab
  onAction: (action: PeerRowAction, row: PeerTableRow) => void
}): React.JSX.Element {
  const items: ContextMenuItem[] = []
  if (tab === 'active' && row.connected) {
    items.push(
      {
        id: 'ban',
        label: PEER_ACTION_LABELS.ban,
        icon: <TurnOffIcon size={10} color="currentColor" />,
        onSelect: () => onAction('ban', row),
      },
      {
        id: 'add-static',
        label: PEER_ACTION_LABELS.addStatic,
        icon: <AddIcon size={10} color="currentColor" />,
        onSelect: () => onAction('add-static', row),
      },
    )
  }
  if (tab === 'active' && row.configuredList === 'dynamic') {
    items.push({
      id: 'remove-dynamic',
      label: PEER_ACTION_LABELS.remove,
      icon: <DeleteIcon size={10} color="currentColor" />,
      onSelect: () => onAction('remove-dynamic', row),
    })
  } else if (tab === 'static') {
    items.push({
      id: 'remove-static',
      label: PEER_ACTION_LABELS.remove,
      icon: <DeleteIcon size={10} color="currentColor" />,
      onSelect: () => onAction('remove-static', row),
    })
  } else if (tab === 'banned') {
    items.push({
      id: 'unban',
      label: PEER_ACTION_LABELS.unban,
      icon: <CheckmarkIcon size={10} color="currentColor" />,
      onSelect: () => onAction('unban', row),
    })
  }

  const offlineDynamic = tab === 'active'
    && row.configuredList === 'dynamic'
    && !row.connected
  const liveDetails = [row.userAgent, row.pingTime]
    .filter(value => value !== PEER_UNAVAILABLE_LABEL)
    .join(' · ')
  const staticConnectionState = row.connected ? 'connected' : 'disconnected'
  const staticDisplay = STATIC_PEER_STATE_DISPLAY[configuredMode ?? 'static'][staticConnectionState]
  const staticStatus = staticDisplay.status
  const staticDetails = liveDetails || staticDisplay.details
  const rowAriaLabel = tab === 'static'
    ? `${row.peer}, ${staticStatus}`
    : tab === 'banned'
      ? `${row.peer}, ${BANNED_PEER_STATUS_LABEL.toLowerCase()}`
      : offlineDynamic
        ? `${row.peer}, configured but not connected`
        : row.peer
  const content = (
    <div
      tabIndex={disabled ? -1 : 0}
      aria-label={rowAriaLabel}
      title={offlineDynamic ? 'Configured dynamic peer is not connected' : undefined}
      className={`
        grid min-h-[3.625rem] ${PEER_TABLE_GRID_CLASS_NAMES[tab]} items-center gap-3 border-t border-dash-primary-dark-blue/10 px-4 outline-none transition-colors dark:border-white/10
        ${disabled ? 'cursor-wait opacity-60' : 'cursor-context-menu hover:bg-dash-primary-dark-blue/4 focus:bg-dash-primary-dark-blue/4 dark:hover:bg-white/5 dark:focus:bg-white/5'}
        ${offlineDynamic ? 'bg-dash-orange/8 dark:bg-dash-orange/10' : ''}
      `}
    >
      <Text
        size={14}
        weight="medium"
        color="brand"
        className={`cursor-text select-text truncate ${offlineDynamic ? 'text-dash-orange!' : ''}`}
      >
        {row.peer}
      </Text>
      {tab === 'active' && (
        <>
          <Text size={14} weight="medium" color="brand" className="truncate">
            {row.userAgent}
          </Text>
          <Text size={14} weight="medium" color="brand" className="justify-self-end whitespace-nowrap">
            {row.pingTime}
          </Text>
        </>
      )}
      {tab === 'static' && (
        <>
          <Text
            size={12}
            weight="medium"
            className={`inline-flex w-fit rounded-full px-2.5 py-1 ${row.connected ? 'bg-dash-green-15 text-dash-green!' : 'bg-dash-orange/10 text-dash-orange!'}`}
          >
            {staticStatus}
          </Text>
          <div className="truncate" title={staticDetails}>
            <Text size={12} weight="medium" color="brand" opacity={60}>
              {staticDetails}
            </Text>
          </div>
        </>
      )}
      {tab === 'banned' && (
        <Text
          size={12}
          weight="medium"
          color="brand"
          opacity={60}
          className="inline-flex w-fit rounded-full bg-dash-primary-dark-blue/8 px-2.5 py-1 dark:bg-white/8"
        >
          {BANNED_PEER_STATUS_LABEL}
        </Text>
      )}
    </div>
  )

  if (disabled || items.length === 0) return content
  return <ContextMenu title={PEER_ACTION_MENU_TITLE} items={items}>{content}</ContextMenu>
}

export default function CoreTab(): React.JSX.Element {
  const {status} = useAuth()
  const {desired, ready, setDesired} = useConnectionModeContext()
  const sync = status?.walletSync
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null
  const phase = sync?.phase ?? WalletSyncPhase.Stopped
  const syncInactive = isWalletSyncInactive(phase)
  const [pendingSyncAction, setPendingSyncAction] = useState<WalletSyncAction | null>(null)
  const [peerTab, setPeerTab] = useState<PeerTableTab>('active')
  const [rpcConnection, setRpcConnection] = useState(RPC_CONNECTION_NAME)
  const [addPeerOpen, setAddPeerOpen] = useState(false)
  const peerSettings = usePeerSettings(network, peerTab !== 'banned')
  const syncPending = pendingSyncAction !== null
  const peerMutationPending = peerSettings.pending !== null
  const peerRows = useMemo(() => {
    if (network === null || !peerSettings.settingsReady) return []
    return buildPeerTableRows({
      connectedPeers: peerSettings.connectedPeers,
      dynamicPeers: peerSettings.dynamicPeers,
      staticPeers: peerSettings.staticPeers,
      bannedPeers: peerSettings.bannedPeers,
      network,
    })[peerTab]
  }, [
    network,
    peerSettings.bannedPeers,
    peerSettings.connectedPeers,
    peerSettings.dynamicPeers,
    peerSettings.staticPeers,
    peerSettings.settingsReady,
    peerTab,
  ])

  useEffect(() => {
    if (pendingSyncAction === 'start' && !syncInactive) {
      setPendingSyncAction(null)
    } else if (pendingSyncAction === 'stop' && syncInactive) {
      setPendingSyncAction(null)
    }
  }, [pendingSyncAction, syncInactive])

  useEffect(() => {
    setAddPeerOpen(false)
  }, [network])

  useEffect(() => {
    if (peerSettings.error !== null) toast.error(peerSettings.error)
  }, [peerSettings.error])

  const handleStartSync = async (): Promise<void> => {
    if (!walletId || syncPending || !syncInactive) return
    setPendingSyncAction('start')
    try {
      await API.startWalletSync(walletId)
      setWalletSyncEnabled(true)
    } catch (err) {
      setPendingSyncAction(null)
      console.error('start wallet sync failed', err)
      toast.error(`**Could not start synchronization** ${getErrorMessage(err)}`)
    }
  }

  const handleStopSync = async (): Promise<void> => {
    if (syncPending || syncInactive) return
    setPendingSyncAction('stop')
    try {
      await API.stopWalletSync()
      setWalletSyncEnabled(false)
    } catch (err) {
      setPendingSyncAction(null)
      console.error('stop wallet sync failed', err)
      toast.error(`**Could not stop synchronization** ${getErrorMessage(err)}`)
    }
  }

  const handleP2pToggle = (): void => {
    if (syncInactive) {
      void handleStartSync()
    } else {
      void handleStopSync()
    }
  }

  const handleStaticPeersToggle = async (): Promise<void> => {
    if (!peerSettings.settingsReady || peerMutationPending) return
    const enabling = peerSettings.configuredMode !== 'static'
    if (enabling && peerSettings.staticPeers.length === 0) {
      setPeerTab('static')
      setAddPeerOpen(true)
      toast.warning(`**Static peer required** ${STATIC_PEER_REQUIRED_MESSAGE}`)
      return
    }

    peerSettings.clearError()
    try {
      await peerSettings.setMode(enabling ? 'static' : 'dynamic')
      toast.success(
        enabling ? STATIC_PEER_MODE_ENABLED_MESSAGE : DYNAMIC_PEER_MODE_ENABLED_MESSAGE,
      )
      if (enabling) {
        setPeerTab('static')
        setAddPeerOpen(false)
      }
    } catch (error) {
      console.error('set peer mode failed', error)
    }
  }

  const handlePeerTabChange = (tab: PeerTableTab): void => {
    if (peerMutationPending) return
    setPeerTab(tab)
    setAddPeerOpen(false)
  }

  const handleAddPeer = async (peer: string): Promise<void> => {
    peerSettings.clearError()
    try {
      if (peerTab === 'active') {
        const added = await peerSettings.addDynamicPeer(peer)
        if (added) toast.success(DYNAMIC_PEER_ADDED_MESSAGE)
        else toast.warning(DYNAMIC_PEER_ALREADY_ADDED_MESSAGE)
      } else if (peerTab === 'static') {
        const added = await peerSettings.addStaticPeer(peer)
        if (!added) {
          toast.warning(STATIC_PEER_ALREADY_ADDED_MESSAGE)
          return
        }
        toast.success(
          peerSettings.configuredMode === 'static'
            ? STATIC_PEER_ADDED_MESSAGE
            : STATIC_PEER_READY_MESSAGE,
        )
      } else {
        const banned = await peerSettings.banPeer(peer)
        if (banned) toast.success(PEER_BANNED_MESSAGE)
        else toast.warning(PEER_ALREADY_BANNED_MESSAGE)
      }
    } catch (error) {
      console.error('add peer failed', error)
      throw error
    }
  }

  const handlePeerAction = async (action: PeerRowAction, row: PeerTableRow): Promise<void> => {
    peerSettings.clearError()
    try {
      if (action === 'ban') {
        const banned = await peerSettings.banPeer(row.peer)
        if (banned) toast.success(PEER_BANNED_MESSAGE)
        else toast.warning(PEER_ALREADY_BANNED_MESSAGE)
      } else if (action === 'add-static') {
        const added = await peerSettings.addStaticPeer(row.peer)
        if (!added) {
          toast.warning(STATIC_PEER_ALREADY_ADDED_MESSAGE)
          return
        }
        toast.success(
          peerSettings.configuredMode === 'static'
            ? STATIC_PEER_ADDED_MESSAGE
            : STATIC_PEER_READY_MESSAGE,
        )
      } else if (action === 'remove-dynamic') {
        await peerSettings.removeDynamicPeer(row.entry)
        toast.success(PEER_REMOVED_MESSAGE)
      } else if (action === 'remove-static') {
        await peerSettings.removeStaticPeer(row.entry)
        toast.success(PEER_REMOVED_MESSAGE)
      } else {
        await peerSettings.unbanPeer(row.entry)
        toast.success(PEER_UNBANNED_MESSAGE)
      }
    } catch (error) {
      console.error('peer action failed', error)
    }
  }

  const peerEmptyState = getPeerEmptyState(network, peerTab, peerSettings, syncInactive)

  return (
    <div className="px-1 pb-2">
      <SectionTitle label="General" tooltip={CONNECTION_SETTINGS_TOOLTIPS.general} />
      <div className="max-w-[24rem]">
        <SettingsRow label="Wallet Connection">
          <WalletConnectionSelector desired={desired} ready={ready} setDesired={setDesired} />
        </SettingsRow>
      </div>

      <SectionTitle label="P2P Connection" tooltip={CONNECTION_SETTINGS_TOOLTIPS.p2p} className="mt-6" />
      <div className="grid max-w-[24rem] gap-4">
        <SettingsRow label="Enable P2P">
          <SwitchControl
            checked={!syncInactive}
            disabled={walletId === null || syncPending}
            label="Enable P2P synchronization"
            onChange={handleP2pToggle}
          />
        </SettingsRow>
        <SettingsRow label="Use Static Peers">
          <SwitchControl
            checked={peerSettings.configuredMode === 'static'}
            disabled={!peerSettings.settingsReady || peerMutationPending}
            label="Use static peers"
            onChange={() => void handleStaticPeersToggle()}
          />
        </SettingsRow>
      </div>

      <SectionTitle label="RPC Connection" tooltip={CONNECTION_SETTINGS_TOOLTIPS.rpc} className="mt-6" />
      <div className="max-w-[24rem]">
        <DropdownField
          options={RPC_CONNECTION_OPTIONS}
          value={rpcConnection}
          onChange={setRpcConnection}
          ariaLabel="RPC connection"
          triggerClassName="h-[3.75rem] rounded-[1.25rem] border border-dash-primary-dark-blue/25 px-5 dark:border-white/25"
        />
      </div>

      <div className="mt-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Text as="h2" size={14} weight="medium" color="brand" opacity={50}>
                Peers List
              </Text>
              <InfoTooltip content={CONNECTION_SETTINGS_TOOLTIPS.peers} />
            </div>
            <div className="flex items-center gap-2">
              {PEER_TABLE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  disabled={peerMutationPending}
                  onClick={() => handlePeerTabChange(tab.value)}
                  className={`
                    h-8 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60
                    ${peerTab === tab.value
                      ? 'bg-dash-primary-dark-blue/8 text-dash-primary-dark-blue dark:bg-white/8 dark:text-white'
                      : 'text-dash-primary-dark-blue/35 hover:text-dash-primary-dark-blue dark:text-white/35 dark:hover:text-white'}
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            disabled={!peerSettings.settingsReady || peerMutationPending}
            onClick={() => {
              peerSettings.clearError()
              setAddPeerOpen(true)
            }}
            variant="solid"
            colorScheme={peerTab === 'banned' ? 'danger-light' : 'lightBlue-mint'}
            size="sm"
            className="min-h-0! gap-2 rounded-[.75rem] p-2! text-xs!"
          >
            <AddIcon size={12} color="currentColor" />
            {PEER_TABLE_ACTION_LABELS[peerTab]}
          </Button>
        </div>

        {peerSettings.pending === 'add-static' && !addPeerOpen && (
          <div className="mb-3 px-1" role="status">
            <Text size={12} weight="medium" color="brand" opacity={50}>
              {PEER_CHECKING_LABEL}
            </Text>
          </div>
        )}

        <div className="overflow-hidden rounded-[1.25rem] border border-dash-primary-dark-blue/15 dark:border-white/15">
          <div className={`grid ${PEER_TABLE_GRID_CLASS_NAMES[peerTab]} items-center gap-3 px-[.9375rem] py-3`}>
            {PEER_TABLE_COLUMN_LABELS[peerTab].map((label, index) => (
              <Text
                key={label}
                size={12}
                weight="normal"
                color="brand"
                opacity={50}
                className={peerTab === 'active' && index === 2 ? 'justify-self-end whitespace-nowrap' : ''}
              >
                {label}
              </Text>
            ))}
          </div>
          {addPeerOpen && (
            <AddPeerForm
              pendingLabel={peerTab === 'static' ? PEER_CHECKING_LABEL : PEER_SAVING_LABEL}
              tab={peerTab}
              onClose={() => setAddPeerOpen(false)}
              onSubmit={handleAddPeer}
            />
          )}
          {peerRows.map((row) => (
            <PeerRow
              key={row.id}
              configuredMode={peerSettings.configuredMode}
              disabled={peerMutationPending}
              row={row}
              tab={peerTab}
              onAction={(action, selectedRow) => void handlePeerAction(action, selectedRow)}
            />
          ))}
          {peerRows.length === 0 && !addPeerOpen && (
            <div
              className="flex min-h-[3.625rem] items-center justify-center gap-2 border-t border-dash-primary-dark-blue/10 px-4 dark:border-white/10"
              role={peerEmptyState.loading ? 'status' : undefined}
            >
              {peerEmptyState.loading && (
                <Spinner size={16} className="text-dash-brand dark:text-dash-mint" />
              )}
              <Text size={14} weight="medium" color="brand" opacity={40}>
                {peerEmptyState.label}
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
