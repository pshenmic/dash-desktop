import { useEffect, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import type { LogLevel } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Button, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import PageHeader from '@renderer/components/ui/PageHeader'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { toast } from '@renderer/components/ui/Toast'
import { SettingsRow, SwitchControl } from '@renderer/components/pages/connectionSettings/SettingsControls'
import { useFiat } from '@renderer/hooks/useFiat'
import { useThemePreference, setThemePreference } from '@renderer/hooks/useThemeController'
import { useZoomPreference, setZoomPreference } from '@renderer/hooks/useZoomController'
import { useDebugMode, setDebugMode } from '@renderer/hooks/useDebugMode'
import { CURRENCY_OPTIONS, LOG_LEVEL_OPTIONS, THEME_OPTIONS, ZOOM_OPTIONS } from '@renderer/constants/settingsPage'
import { SETTINGS_INLINE_INPUT } from '@renderer/constants/settingsControls'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import type { SettingsRowProps } from '@renderer/types/Settings'
import { transactionsToCsv, CsvTxRow } from '@renderer/utils/csv'
import { getErrorMessage } from '@renderer/utils/error'
import { walletDisplayNameById } from '@renderer/utils/walletName'
import { useWallets, refreshWallets } from '@renderer/hooks/useWallets'
import { invalidateAllAsyncCaches } from '@renderer/hooks/useAsyncWithCache'
import { ModalSize } from '@renderer/enums/ModalSize'
import { ModalActionTone } from '@renderer/enums/ModalActionTone'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import DeleteWallet from '@renderer/components/modal/DeleteWallet'
import ExportMnemonic from '@renderer/components/modal/ExportMnemonic'
import { useNavigate } from 'react-router-dom'

function SettingsActionRow({
  title,
  description,
  control,
  actionLabel,
  pendingLabel,
  pending = false,
  disabled = false,
  destructive = false,
  onClick,
}: SettingsRowProps): React.JSX.Element {
  return (
    <SettingsRow label={title} description={description}>
      {control ?? (
        <Button
          onClick={onClick}
          disabled={disabled || pending}
          variant={destructive ? 'outline' : 'solid'}
          colorScheme={destructive ? 'red' : 'primary-light'}
          size="compact"
        >
          {pending && pendingLabel ? pendingLabel : actionLabel}
        </Button>
      )}
    </SettingsRow>
  )
}

function SectionLabel({ children }: { children: string }): React.JSX.Element {
  return (
    <div className="mb-2 mt-6 first:mt-0">
      <Text size={12} weight="medium" color="brand" opacity={50} transform="uppercase">
        {children}
      </Text>
    </div>
  )
}

export default function Settings(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null

  const themePreference = useThemePreference()
  const zoomPreference = useZoomPreference()
  const { currency, setCurrency } = useFiat()
  const debugMode = useDebugMode()

  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [clearPending, setClearPending] = useState(false)
  const clearPendingRef = useRef(false)
  const [exportPending, setExportPending] = useState(false)
  const [logLevel, setLogLevel] = useState<LogLevel | null>(null)
  const [logLevelLoading, setLogLevelLoading] = useState(true)
  const [logLevelLoadAttempt, setLogLevelLoadAttempt] = useState(0)
  const [logLevelPending, setLogLevelPending] = useState(false)
  const logLevelPendingRef = useRef(false)

  const wallets = useWallets()
  const currentLabel = useMemo(
    () => wallets.find((w) => w.walletId === walletId)?.label ?? null,
    [wallets, walletId],
  )

  const [walletName, setWalletName] = useState('')
  const [renamePending, setRenamePending] = useState(false)

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [walletToDelete, setWalletToDelete] = useState<string | null>(null)
  const walletToDeleteName = walletDisplayNameById(wallets, walletToDelete)
  const [isMnemonicOpen, setIsMnemonicOpen] = useState(false)

  const openDelete = (): void => {
    if (!walletId) return
    setWalletToDelete(walletId)
    setIsDeleteOpen(true)
  }

  useEffect(() => {
    setWalletName(currentLabel ?? '')
  }, [currentLabel])

  useEffect(() => {
    let cancelled = false
    setLogLevelLoading(true)
    API.getPreferences()
      .then((preferences) => {
        if (!cancelled) setLogLevel(preferences.general.logLevel)
      })
      .catch((error) => {
        if (!cancelled) toast.error(`**Log level failed** ${getErrorMessage(error)}`)
      })
      .finally(() => {
        if (!cancelled) setLogLevelLoading(false)
      })
    return () => { cancelled = true }
  }, [logLevelLoadAttempt])

  const isUnchanged = walletName.trim() === (currentLabel ?? '')

  const handleLogLevelChange = async (next: LogLevel): Promise<void> => {
    if (logLevel === null || logLevelPendingRef.current || next === logLevel) return
    logLevelPendingRef.current = true
    setLogLevelPending(true)
    try {
      await API.setLogLevel(next)
      setLogLevel(next)
    } catch (error) {
      toast.error(`**Log level failed** ${getErrorMessage(error)}`)
    } finally {
      logLevelPendingRef.current = false
      setLogLevelPending(false)
    }
  }

  const handleRename = async (): Promise<void> => {
    if (!walletId || renamePending || isUnchanged) return
    setRenamePending(true)
    try {
      await API.setWalletLabel(walletId, walletName.trim())
      refreshWallets()
    } catch (err) {
      console.error('rename failed', err)
      toast.error(`**Rename failed** ${getErrorMessage(err)}`)
    } finally {
      setRenamePending(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    setIsClearConfirmOpen(false)
    if (!network || clearPendingRef.current) return
    clearPendingRef.current = true
    setClearPending(true)
    try {
      await API.resetWalletSync(network)
      invalidateAllAsyncCaches()
    } catch (err) {
      console.error('reset sync failed', err)
      toast.error(`**Clear failed** ${getErrorMessage(err)}`)
    } finally {
      clearPendingRef.current = false
      setClearPending(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    if (!walletId || exportPending) return
    setExportPending(true)
    try {
      const { core } = await API.getTransactions(walletId)
      const rows: CsvTxRow[] = core.map((tx) => ({
        date: new Date(tx.date),
        direction: tx.direction === 1 ? 'in' : 'out',
        amountDuffs: tx.transferAmount,
        address: tx.address,
        txid: tx.txid,
        status: tx.status,
        confirmations: tx.confirmations,
        blockHeight: tx.blockHeight,
      }))
      if (rows.length === 0) {
        toast.error('**No transactions to export**')
        return
      }
      const stamp = new Date().toISOString().slice(0, 10)
      const csv = transactionsToCsv(rows)
      await API.saveTextFile(`dash-transactions-${network ?? 'wallet'}-${stamp}.csv`, csv)
    } catch (err) {
      console.error('export failed', err)
      toast.error(`**Export failed** ${getErrorMessage(err)}`)
    } finally {
      setExportPending(false)
    }
  }

  return (
    <div className="w-full px-12 pb-12">
      <PageHeader title={PAGE_HEADERS.settings.title} subtitle={PAGE_HEADERS.settings.subtitle} />
      <div className={SURFACE_PANEL}>
        <SectionLabel>Wallet</SectionLabel>
        <div className="flex flex-col gap-[.625rem]">
          <SettingsActionRow
            title="Wallet name"
            control={
              <div className="flex items-center gap-2">
                <Input
                  id="wallet-name"
                  type="text"
                  placeholder="Wallet name"
                  value={walletName}
                  variant="filled"
                  colorScheme="light"
                  onChange={(e) => setWalletName(e.target.value)}
                  className={`w-56 ${SETTINGS_INLINE_INPUT}`}
                />
                <Button
                  onClick={handleRename}
                  disabled={walletId === null || renamePending || isUnchanged}
                  variant="solid"
                  colorScheme="primary-light"
                  size="compact"
                >
                  {renamePending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            }
          />
          <SettingsActionRow
            title="Recovery phrase"
            description="View this wallet's recovery phrase."
            actionLabel="Reveal phrase"
            disabled={walletId === null}
            onClick={() => setIsMnemonicOpen(true)}
          />
          <SettingsActionRow
            title="Export transactions"
            description="Save this wallet's transaction history as a CSV file."
            actionLabel="Export CSV"
            pendingLabel="Exporting…"
            pending={exportPending}
            disabled={walletId === null}
            onClick={handleExport}
          />
        </div>

        <SectionLabel>Appearance</SectionLabel>
        <div className="flex flex-col gap-[.625rem]">
          <SettingsActionRow
            title="Theme"
            control={
              <SegmentedControl
                options={THEME_OPTIONS}
                value={themePreference}
                onChange={setThemePreference}
              />
            }
          />
          <SettingsActionRow
            title="Interface scale"
            description="Scale the whole interface, including fonts."
            control={
              <SegmentedControl
                options={ZOOM_OPTIONS}
                value={zoomPreference}
                onChange={setZoomPreference}
              />
            }
          />
          <SettingsActionRow
            title="Display currency"
            control={
              <SegmentedControl
                options={CURRENCY_OPTIONS}
                value={currency}
                onChange={setCurrency}
              />
            }
          />
        </div>

        <SectionLabel>Logging</SectionLabel>
        <div className="flex flex-col gap-[.625rem]">
          <SettingsActionRow
            title="Log level"
            control={logLevelLoading ? (
              <Text size={12} color="brand" opacity={50}>Loading…</Text>
            ) : logLevel === null ? (
              <Button
                onClick={() => setLogLevelLoadAttempt((attempt) => attempt + 1)}
                variant="solid"
                colorScheme="primary-light"
                size="compact"
              >
                Retry
              </Button>
            ) : (
              <fieldset
                aria-label="Log level"
                aria-busy={logLevelPending}
                disabled={logLevelPending}
                className="m-0 shrink-0 border-0 p-0 disabled:opacity-50"
              >
                <SegmentedControl
                  options={LOG_LEVEL_OPTIONS}
                  value={logLevel}
                  onChange={(value) => { void handleLogLevelChange(value) }}
                />
              </fieldset>
            )}
          />
          <SettingsActionRow
            title="Application logs"
            description="Review diagnostic logs and save a file to share with support."
            actionLabel="View logs"
            onClick={() => navigate('/settings/logs')}
          />
        </div>

        <SectionLabel>Connection</SectionLabel>
        <div className="flex flex-col gap-[.625rem]">
          <SettingsActionRow
            title="Connection settings"
            description="Choose the wallet data source and manage P2P synchronization."
            actionLabel="Open Connection Settings"
            onClick={() => navigate('/connection-settings')}
          />
          <SettingsActionRow
            title="Clear sync data"
            description="Deletes downloaded chain data and transaction history for this network. Wallets are kept."
            actionLabel="Clear sync data"
            pendingLabel="Clearing…"
            pending={clearPending}
            disabled={network === null}
            destructive
            onClick={() => setIsClearConfirmOpen(true)}
          />
        </div>

        <SectionLabel>Maintenance</SectionLabel>
        <div className="flex flex-col gap-[.625rem]">
          <SettingsActionRow
            title="Advanced mode"
            description="Show developer pages like the Shielded debug view."
            control={
              <SwitchControl
                checked={debugMode}
                label="Advanced mode"
                onChange={setDebugMode}
              />
            }
          />
        </div>

        <SectionLabel>Danger zone</SectionLabel>
        <div className="flex flex-col gap-[.625rem]">
          <SettingsActionRow
            title="Delete wallet"
            description="Permanently remove this wallet from this device. Make sure you have its recovery phrase backed up first."
            actionLabel="Delete wallet"
            disabled={walletId === null}
            destructive
            onClick={openDelete}
          />
        </div>
      </div>

      <DeleteWallet
        isDeleteOpen={isDeleteOpen}
        setIsDeleteOpen={setIsDeleteOpen}
        walletToDelete={walletToDelete}
        walletName={walletToDeleteName}
        setWalletToDelete={setWalletToDelete}
        refreshWallets={refreshWallets}
      />

      <Modal
        open={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        title={`Clear ${network} sync data?`}
        description={`Clears transaction history for all wallets on ${network}. Wallets and recovery phrases are kept.`}
        size={ModalSize.Md}
      >
        <ModalActions
          tone={ModalActionTone.Danger}
          secondary={{ label: 'Cancel', onClick: () => setIsClearConfirmOpen(false) }}
          primary={{ label: 'Clear', onClick: () => { void handleClear() } }}
        />
      </Modal>

      <ExportMnemonic
        isOpen={isMnemonicOpen}
        onClose={() => setIsMnemonicOpen(false)}
        walletId={walletId}
      />
    </div>
  )
}
