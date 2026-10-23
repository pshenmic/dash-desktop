import {useEffect, useMemo, useState} from 'react'
import {
  AddIcon,
  Button,
  CheckmarkIcon,
  CloseIcon,
  DeleteIcon,
  InfoTooltip,
  Text,
} from '@renderer/components/dash-ui-kit-enxtended'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import DropdownField from '@renderer/components/ui/DropdownField'
import Spinner from '@renderer/components/ui/Spinner'
import {toast} from '@renderer/components/ui/Toast'
import {useAuth} from '@renderer/contexts/AuthContext'
import {usePlatformNodeSettings} from '@renderer/hooks/usePlatformNodeSettings'
import {
  CONNECTION_SETTINGS_TOOLTIPS,
  PLATFORM_EXPLORER_CONNECTION_NAME,
  PLATFORM_EXPLORER_CONNECTION_OPTIONS,
} from '@renderer/constants/connection'
import {
  ADD_PLATFORM_NODE_PLACEHOLDER,
  PLATFORM_NODE_COLUMN_LABELS,
  PLATFORM_NODE_MODE_LABELS,
  PLATFORM_NODE_SWITCH_POSITIONS,
  PLATFORM_NODE_TABLE_GRID_CLASS_NAME,
  PLATFORM_NODE_TABLE_TABS,
  PLATFORM_STATIC_NODE_REQUIRED_MESSAGE,
} from '@renderer/constants/platformNodes'
import type {PeerMode} from '@renderer/api/types'
import type {
  AddPlatformNodeFormProps,
  PlatformNodeRowProps,
  PlatformNodeTableTab,
} from '@renderer/types/platformNodes'
import {buildPlatformNodeRows, getPlatformNodeEmptyLabel} from '@renderer/utils/platformNodes'
import {getErrorMessage} from '@renderer/utils/error'
import {SectionTitle, SettingsRow, SwitchControl} from './SettingsControls'

function AddNodeForm({disabled, onClose, onSubmit}: AddPlatformNodeFormProps): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (): Promise<void> => {
    if (url.trim().length === 0 || submitting || disabled) return
    setSubmitting(true)
    try {
      if (await onSubmit(url.trim())) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        void submit()
      }}
      className="flex min-h-[3.625rem] items-center gap-2 border-t border-dash-primary-dark-blue/10 px-4 py-2 dark:border-white/10"
    >
      <input
        type="text"
        aria-label="Platform node HTTPS URL"
        placeholder={ADD_PLATFORM_NODE_PLACEHOLDER}
        value={url}
        disabled={submitting || disabled}
        autoFocus
        onChange={event => setUrl(event.target.value)}
        className="h-11 min-w-0 flex-1 rounded-[.75rem] bg-dash-primary-dark-blue/5 px-4 text-sm font-medium text-dash-primary-dark-blue outline-none placeholder:text-dash-primary-dark-blue/35 focus:ring-2 focus:ring-dash-brand/25 dark:bg-white/8 dark:text-white dark:placeholder:text-white/35 dark:focus:ring-dash-mint/25"
      />
      <button
        type="submit"
        aria-label={submitting ? 'Saving Platform node' : 'Confirm Platform node'}
        disabled={submitting || disabled || url.trim().length === 0}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[.5rem] bg-dash-mint/20 text-dash-mint hover:bg-dash-mint/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Spinner size={12} /> : <CheckmarkIcon size={12} color="currentColor" />}
      </button>
      <button
        type="button"
        aria-label="Close Platform node form"
        disabled={submitting}
        onClick={onClose}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[.5rem] bg-dash-primary-dark-blue/8 text-dash-primary-dark-blue/45 hover:bg-dash-primary-dark-blue/12 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-white/45 dark:hover:bg-white/15"
      >
        <CloseIcon size={10} color="currentColor" />
      </button>
    </form>
  )
}

function NodeRow({row, removable, disabled, onRemove}: PlatformNodeRowProps): React.JSX.Element {
  const content = (
    <div
      tabIndex={removable && !disabled ? 0 : undefined}
      aria-label={`${row.url}, ${row.status}${row.error === null ? '' : `: ${row.error}`}`}
      className={`grid min-h-[3.625rem] ${PLATFORM_NODE_TABLE_GRID_CLASS_NAME} items-center gap-3 border-t border-dash-primary-dark-blue/10 px-4 py-3 outline-none dark:border-white/10 ${removable && !disabled
        ? 'cursor-context-menu hover:bg-dash-primary-dark-blue/4 focus:bg-dash-primary-dark-blue/4 dark:hover:bg-white/5 dark:focus:bg-white/5'
        : ''}`}
    >
      <div className="flex min-w-0 flex-col items-start gap-1" title={row.proTxHash ?? row.url}>
        <Text size={14} weight="medium" color="brand" className="w-full cursor-text select-text truncate">
          {row.url}
        </Text>
        <span title={row.error ?? undefined}>
          <Text
            size={12}
            weight="medium"
            className={`inline-flex w-fit rounded-full px-2.5 py-1 ${row.available
              ? 'bg-dash-green-15 text-dash-green!'
              : 'bg-dash-primary-dark-blue/8 text-dash-primary-dark-blue/60 dark:bg-white/8 dark:text-white/60'}`}
          >
            {row.status}
          </Text>
        </span>
      </div>
      <div className="truncate" title={row.driveVersion}>
        <Text size={14} weight="medium" color="brand">{row.driveVersion}</Text>
      </div>
      <div className="truncate" title={row.blockHeight}>
        <Text size={14} weight="medium" color="brand">{row.blockHeight}</Text>
      </div>
      <Text size={14} weight="medium" color="brand" className="justify-self-end whitespace-nowrap">
        {row.pingTime}
      </Text>
    </div>
  )
  if (!removable || disabled) return content
  return (
    <ContextMenu
      title="Node Actions"
      items={[{
        id: 'remove-static',
        label: 'Remove Node',
        icon: <DeleteIcon size={10} color="currentColor" />,
        onSelect: () => onRemove(row.entry),
      }]}
    >
      {content}
    </ContextMenu>
  )
}

export default function PlatformTab(): React.JSX.Element {
  const {status} = useAuth()
  const network = status?.network ?? null
  const nodeSettings = usePlatformNodeSettings(network)
  const [nodeTab, setNodeTab] = useState<PlatformNodeTableTab>('active')
  const [addNodeOpen, setAddNodeOpen] = useState(false)
  const [explorerConnection, setExplorerConnection] = useState(PLATFORM_EXPLORER_CONNECTION_NAME)
  const mutationPending = nodeSettings.pending !== null
  const rows = useMemo(() => buildPlatformNodeRows(
    nodeSettings.activeNodes,
    nodeSettings.staticNodes,
    nodeSettings.configuredMode,
  )[nodeTab], [nodeSettings.activeNodes, nodeSettings.staticNodes, nodeSettings.configuredMode, nodeTab])

  useEffect(() => {
    setAddNodeOpen(false)
  }, [network])

  const handleModeChange = async (mode: PeerMode): Promise<void> => {
    if (!nodeSettings.settingsReady || mutationPending) return
    if (mode === 'static' && !nodeSettings.hasStaticNodes) {
      setNodeTab('static')
      setAddNodeOpen(true)
      toast.warning(`**Static node required** ${PLATFORM_STATIC_NODE_REQUIRED_MESSAGE}`)
      return
    }
    try {
      await nodeSettings.setMode(mode)
      toast.success(`${PLATFORM_NODE_MODE_LABELS[mode]} Platform node mode enabled.`)
    } catch (error) {
      console.error('set Platform node mode failed', error)
      toast.error(getErrorMessage(error))
    }
  }

  const handleAddNode = async (url: string): Promise<boolean> => {
    try {
      const added = await nodeSettings.addStaticNode(url)
      if (added) toast.success('Static Platform node added.')
      else toast.warning('This node is already in the static list.')
      return true
    } catch (error) {
      console.error('add Platform node failed', error)
      toast.error(getErrorMessage(error))
      return false
    }
  }

  const handleRemoveNode = async (url: string): Promise<void> => {
    try {
      await nodeSettings.removeStaticNode(url)
      toast.success('Static Platform node removed.')
    } catch (error) {
      console.error('remove Platform node failed', error)
      toast.error(getErrorMessage(error))
    }
  }

  const listLoading = nodeSettings.loading || (nodeTab === 'active' && nodeSettings.activeNodesLoading)
  const emptyLabel = getPlatformNodeEmptyLabel(network, listLoading, nodeTab)
  const listError = nodeSettings.error ?? nodeSettings.activeNodesError

  return (
    <div className="px-1 pb-2">
      <SectionTitle label="DAPI Connection" tooltip={CONNECTION_SETTINGS_TOOLTIPS.dapi} />
      <div className="grid max-w-[24rem] gap-4">
        <SettingsRow label="Node Selection">
          <SwitchControl
            checked={nodeSettings.configuredMode === null ? null : nodeSettings.configuredMode === 'static'}
            disabled={!nodeSettings.settingsReady || mutationPending}
            label="Platform node selection mode"
            positions={PLATFORM_NODE_SWITCH_POSITIONS}
            onChange={checked => void handleModeChange(checked ? 'static' : 'dynamic')}
          />
        </SettingsRow>
      </div>

      <SectionTitle label="Platform Explorer Connection" tooltip={CONNECTION_SETTINGS_TOOLTIPS.platformExplorer} className="mt-7" />
      <fieldset disabled className="grid max-w-[24rem] gap-4">
        <DropdownField
          options={PLATFORM_EXPLORER_CONNECTION_OPTIONS}
          value={explorerConnection}
          onChange={setExplorerConnection}
          ariaLabel="Platform explorer connection"
          triggerClassName="h-[3.75rem] rounded-[1.25rem] border border-dash-primary-dark-blue/25 px-5 dark:border-white/25"
        />
      </fieldset>

      <div className="mt-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Text as="h2" size={14} weight="medium" color="brand" opacity={50}>
                Nodes List
              </Text>
              <InfoTooltip content={CONNECTION_SETTINGS_TOOLTIPS.platformNodes} />
            </div>
            <div className="flex items-center gap-2" role="group" aria-label="Platform node lists">
              {PLATFORM_NODE_TABLE_TABS.map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={nodeTab === tab.value}
                  disabled={mutationPending}
                  onClick={() => {
                    setNodeTab(tab.value)
                    setAddNodeOpen(false)
                  }}
                  className={`h-8 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${nodeTab === tab.value
                    ? 'bg-dash-primary-dark-blue/8 text-dash-primary-dark-blue dark:bg-white/8 dark:text-white'
                    : 'text-dash-primary-dark-blue/35 hover:text-dash-primary-dark-blue dark:text-white/35 dark:hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {nodeTab === 'static' && (
            <Button
              type="button"
              disabled={!nodeSettings.settingsReady || mutationPending}
              onClick={() => setAddNodeOpen(true)}
              variant="solid"
              colorScheme="lightBlue-mint"
              size="sm"
              className="min-h-0! gap-2 rounded-[.75rem] p-2! text-xs!"
            >
              <AddIcon size={12} color="currentColor" />
              Add Node
            </Button>
          )}
        </div>

        {listError && (
          <div role="alert" className="mb-3 flex items-center justify-between gap-3 px-1">
            <Text size={12} weight="medium" className="text-dash-orange!">{listError}</Text>
            <button type="button" disabled={mutationPending} onClick={nodeSettings.reload} className="shrink-0 cursor-pointer text-xs font-medium text-dash-brand hover:underline disabled:opacity-50 dark:text-dash-mint">
              Retry
            </button>
          </div>
        )}
        <div className="overflow-x-auto rounded-[1.25rem] border border-dash-primary-dark-blue/15 dark:border-white/15">
          <div className="min-w-[36rem]">
            <div className={`grid ${PLATFORM_NODE_TABLE_GRID_CLASS_NAME} items-center gap-3 px-[.9375rem] py-3`}>
              {PLATFORM_NODE_COLUMN_LABELS.map((label, index) => (
                <Text key={label} size={12} weight="normal" color="brand" opacity={50} className={index === 3 ? 'justify-self-end whitespace-nowrap' : ''}>
                  {label}
                </Text>
              ))}
            </div>
            {addNodeOpen && nodeTab === 'static' && (
              <AddNodeForm
                key={network}
                disabled={!nodeSettings.settingsReady || mutationPending}
                onClose={() => setAddNodeOpen(false)}
                onSubmit={handleAddNode}
              />
            )}
            {rows.map(row => (
              <NodeRow
                key={row.id}
                row={row}
                removable={nodeTab === 'static'}
                disabled={!nodeSettings.settingsReady || mutationPending}
                onRemove={url => void handleRemoveNode(url)}
              />
            ))}
            {rows.length === 0 && !addNodeOpen && (
              <div className="flex min-h-[3.625rem] items-center justify-center gap-2 border-t border-dash-primary-dark-blue/10 px-4 dark:border-white/10" role={network !== null && listLoading ? 'status' : undefined}>
                {network !== null && listLoading && <Spinner size={16} className="text-dash-brand dark:text-dash-mint" />}
                <Text size={14} weight="medium" color="brand" opacity={40}>{emptyLabel}</Text>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
