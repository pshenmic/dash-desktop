import {useEffect, useState} from 'react'
import {
  AddIcon,
  Button,
  CheckmarkIcon,
  CloseIcon,
  InfoTooltip,
  Text,
  TurnOffIcon,
} from '@renderer/components/dash-ui-kit-enxtended'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import DropdownField from '@renderer/components/ui/DropdownField'
import {useAuth} from '@renderer/contexts/AuthContext'
import {useConnectionModeContext} from '@renderer/contexts/ConnectionModeContext'
import {
  ADD_PEER_PLACEHOLDER,
  CONNECTION_SETTINGS_TOOLTIPS,
  CORE_CONNECTION_MODE_LABELS,
  CORE_CONNECTION_MODE_OPTIONS,
  PEER_ACTION_LABELS,
  PEER_ACTION_MENU_TITLE,
  PEER_TABLE_ACTION_LABELS,
  PEER_TABLE_EMPTY_LABEL,
  PEER_TABLE_ROWS,
  PEER_TABLE_TABS,
  RPC_CONNECTION_NAME,
  RPC_CONNECTION_OPTIONS,
} from '@renderer/constants/connection'
import {WalletSyncPhase} from '@renderer/api/types'
import {API} from '@renderer/api'
import {toast} from '@renderer/components/ui/Toast'
import {isWalletSyncInactive} from '@renderer/utils/walletSync'
import {getErrorMessage} from '@renderer/utils/error'
import type {
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

function AddPeerForm({onClose}: {onClose: () => void}): React.JSX.Element {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="grid min-h-[3.625rem] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5.5rem] items-center gap-3 border-t border-dash-primary-dark-blue/10 px-4 dark:border-white/10"
    >
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="text"
          aria-label="Peer address"
          placeholder={ADD_PEER_PLACEHOLDER}
          className="h-11 min-w-0 flex-1 rounded-[.75rem] bg-dash-primary-dark-blue/5 px-4 text-sm font-medium text-dash-primary-dark-blue outline-none placeholder:text-dash-primary-dark-blue/35 focus:ring-2 focus:ring-dash-brand/25 dark:bg-white/8 dark:text-white dark:placeholder:text-white/35 dark:focus:ring-dash-mint/25"
        />
        <button
          type="submit"
          aria-label="Confirm peer"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[.5rem] bg-dash-mint/20 text-dash-mint hover:bg-dash-mint/30"
        >
          <CheckmarkIcon size={12} color="currentColor" />
        </button>
        <button
          type="button"
          aria-label="Close peer form"
          onClick={onClose}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[.5rem] bg-dash-primary-dark-blue/8 text-dash-primary-dark-blue/45 hover:bg-dash-primary-dark-blue/12 dark:bg-white/10 dark:text-white/45 dark:hover:bg-white/15"
        >
          <CloseIcon size={10} color="currentColor" />
        </button>
      </div>
    </form>
  )
}

function PeerRow({row}: {row: PeerTableRow}): React.JSX.Element {
  return (
    <ContextMenu
      title={PEER_ACTION_MENU_TITLE}
      items={[
        {
          id: 'ban',
          label: PEER_ACTION_LABELS.ban,
          icon: <TurnOffIcon size={10} color="currentColor" />,
        },
        {
          id: 'add-static',
          label: PEER_ACTION_LABELS.addStatic,
          icon: <AddIcon size={10} color="currentColor" />,
        },
      ]}
    >
      <div
        tabIndex={0}
        className="grid min-h-[3.625rem] cursor-context-menu grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5.5rem] items-center gap-3 border-t border-dash-primary-dark-blue/10 px-4 outline-none transition-colors hover:bg-dash-primary-dark-blue/4 focus:bg-dash-primary-dark-blue/4 dark:border-white/10 dark:hover:bg-white/5 dark:focus:bg-white/5"
      >
        <Text size={14} weight="medium" color="brand" className="truncate">
          {row.peer}
        </Text>
        <Text size={14} weight="medium" color="brand" className="truncate">
          {row.userAgent}
        </Text>
        <Text size={14} weight="medium" color="brand" className="justify-self-end whitespace-nowrap">
          {row.pingTime}
        </Text>
      </div>
    </ContextMenu>
  )
}

export default function CoreTab(): React.JSX.Element {
  const {status} = useAuth()
  const {desired, ready, setDesired} = useConnectionModeContext()
  const sync = status?.walletSync
  const walletId = status?.selectedWalletId ?? null
  const phase = sync?.phase ?? WalletSyncPhase.Stopped
  const syncInactive = isWalletSyncInactive(phase)
  const [pendingSyncAction, setPendingSyncAction] = useState<WalletSyncAction | null>(null)
  const [staticPeersEnabled, setStaticPeersEnabled] = useState(false)
  const [peerTab, setPeerTab] = useState<PeerTableTab>('active')
  const [rpcConnection, setRpcConnection] = useState(RPC_CONNECTION_NAME)
  const [addPeerOpen, setAddPeerOpen] = useState(false)
  const syncPending = pendingSyncAction !== null
  const peerRows = PEER_TABLE_ROWS[peerTab]

  useEffect(() => {
    if (pendingSyncAction === 'start' && !syncInactive) {
      setPendingSyncAction(null)
    } else if (pendingSyncAction === 'stop' && syncInactive) {
      setPendingSyncAction(null)
    }
  }, [pendingSyncAction, syncInactive])

  const handleStartSync = async (): Promise<void> => {
    if (!walletId || syncPending || !syncInactive) return
    setPendingSyncAction('start')
    try {
      await API.startWalletSync(walletId)
      localStorage.setItem('wallet.sync.enabled', 'true')
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
      localStorage.setItem('wallet.sync.enabled', 'false')
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

  const handleStaticPeersToggle = (): void => {
    setStaticPeersEnabled((current) => {
      const next = !current
      if (next) {
        setPeerTab('static')
        setAddPeerOpen(false)
      }
      return next
    })
  }

  const handlePeerTabChange = (tab: PeerTableTab): void => {
    setPeerTab(tab)
    setAddPeerOpen(false)
  }

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
            checked={staticPeersEnabled}
            label="Use static peers"
            onChange={handleStaticPeersToggle}
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
                  onClick={() => handlePeerTabChange(tab.value)}
                  className={`
                    h-8 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors
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
            onClick={() => setAddPeerOpen(true)}
            variant="solid"
            colorScheme={peerTab === 'banned' ? 'danger-light' : 'lightBlue-mint'}
            size="sm"
            className="min-h-0! gap-2 rounded-[.75rem] p-2! text-xs!"
          >
            <AddIcon size={12} color="currentColor" />
            {PEER_TABLE_ACTION_LABELS[peerTab]}
          </Button>
        </div>

        <div className="overflow-hidden rounded-[1.25rem] border border-dash-primary-dark-blue/15 dark:border-white/15">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5.5rem] items-center gap-3 px-[.9375rem] py-3">
            <Text size={12} weight="normal" color="brand" opacity={50}>
              Peers
            </Text>
            <Text size={12} weight="normal" color="brand" opacity={50}>
              User Agent
            </Text>
            <Text size={12} weight="normal" color="brand" opacity={50} className="justify-self-end whitespace-nowrap">
              Ping Time
            </Text>
          </div>
          {addPeerOpen && <AddPeerForm onClose={() => setAddPeerOpen(false)} />}
          {peerRows.map((row) => <PeerRow key={row.id} row={row} />)}
          {peerRows.length === 0 && !addPeerOpen && (
            <div className="flex min-h-[3.625rem] items-center justify-center border-t border-dash-primary-dark-blue/10 px-4 dark:border-white/10">
              <Text size={14} weight="medium" color="brand" opacity={40}>
                {PEER_TABLE_EMPTY_LABEL}
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
