import { useEffect, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import type { LogLevel } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Button, Heading, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { toast } from '@renderer/components/ui/Toast'
import { useFiat } from '@renderer/hooks/useFiat'
import { useThemePreference, setThemePreference } from '@renderer/hooks/useThemeController'
import { useZoomPreference, setZoomPreference } from '@renderer/hooks/useZoomController'
import { useDebugMode, setDebugMode } from '@renderer/hooks/useDebugMode'
import { ADVANCED_MODE_OPTIONS, CURRENCY_OPTIONS, LOG_LEVEL_OPTIONS, THEME_OPTIONS, ZOOM_OPTIONS } from '@renderer/constants/settingsPage'
import type { SettingsRowProps } from '@renderer/types/Settings'
import { transactionsToCsv, CsvTxRow } from '@renderer/utils/csv'
import { getErrorMessage } from '@renderer/utils/error'
import { useWallets, refreshWallets } from '@renderer/hooks/useWallets'
import DeleteWallet from '@renderer/components/modal/DeleteWallet'
import ExportMnemonic from '@renderer/components/modal/ExportMnemonic'
import { useNavigate } from 'react-router-dom'

function SettingsRow({
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
    <div
      className={`
        flex items-center justify-between gap-6
        py-4
        border-b border-dash-primary-dark-blue/8 dark:border-white/12
        last:border-b-0
      `}
    >
      <div className="flex flex-col gap-1">
        <Text size={16} weight="medium" color="brand">{title}</Text>
        <Text size={12} weight="normal" color="brand" opacity={50}>{description}</Text>
      </div>
      {control ?? (
        <Button
          onClick={onClick}
          disabled={disabled || pending}
          variant={destructive ? 'outline' : 'solid'}
          colorScheme={destructive ? 'red' : 'primary-light'}
          size="sm"
          className="min-h-0! py-2! rounded-[.75rem]"
        >
          {pending && pendingLabel ? pendingLabel : actionLabel}
        </Button>
      )}
    </div>
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
        if (!cancelled) toast.error(`**Log level failed** Could not load the log level. ${getErrorMessage(error)}`)
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
      toast.error(`**Log level failed** Could not save the log level. ${getErrorMessage(error)}`)
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
      toast.error(`**Rename failed** Could not update wallet name. ${getErrorMessage(err)}`)
    } finally {
      setRenamePending(false)
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
        toast.error('**No transactions** Nothing to export yet.')
        return
      }
      const stamp = new Date().toISOString().slice(0, 10)
      const csv = transactionsToCsv(rows)
      await API.saveTextFile(`dash-transactions-${network ?? 'wallet'}-${stamp}.csv`, csv)
    } catch (err) {
      console.error('export failed', err)
      toast.error(`**Export failed** Could not export transactions. ${getErrorMessage(err)}`)
    } finally {
      setExportPending(false)
    }
  }

  return (
    <div className="w-full px-12 pb-12">
      <div className="shadow-[8px_0_64px_0_rgba(12,28,51,0.08)] dash-card-base rounded-3xl p-8">
        <div className="mb-6">
          <Heading as="h1" size="xl" weight="extrabold" color="brand-white">
            Settings
          </Heading>
        </div>

        <SectionLabel>Wallet</SectionLabel>
        <div className="flex flex-col">
          <SettingsRow
            title="Wallet name"
            description="A label to identify this wallet across the app."
            control={
              <div className="flex items-center gap-2">
                <Input
                  id="wallet-name"
                  type="text"
                  placeholder="Wallet name"
                  value={walletName}
                  variant="outlined"
                  colorScheme="primary"
                  onChange={(e) => setWalletName(e.target.value)}
                  className="h-10 w-56 rounded-[.75rem] bg-transparent!"
                />
                <Button
                  onClick={handleRename}
                  disabled={walletId === null || renamePending || isUnchanged}
                  variant="solid"
                  colorScheme="primary-light"
                  size="sm"
                  className="min-h-0! py-2! rounded-[.75rem]"
                >
                  {renamePending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            }
          />
          <SettingsRow
            title="Recovery phrase"
            description="Reveal this wallet's secret recovery phrase. Anyone with these words can access your funds."
            actionLabel="Reveal phrase"
            disabled={walletId === null}
            onClick={() => setIsMnemonicOpen(true)}
          />
          <SettingsRow
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
        <div className="flex flex-col">
          <SettingsRow
            title="Theme"
            description="Choose light, dark, or follow your system setting."
            control={
              <SegmentedControl
                options={THEME_OPTIONS}
                value={themePreference}
                onChange={setThemePreference}
              />
            }
          />
          <SettingsRow
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
          <SettingsRow
            title="Display currency"
            description="Currency used for fiat values across the wallet."
            control={
              <SegmentedControl
                options={CURRENCY_OPTIONS}
                value={currency}
                onChange={setCurrency}
              />
            }
          />
        </div>

        <SectionLabel>Maintenance</SectionLabel>
        <div className="flex flex-col">
          <SettingsRow
            title="Advanced mode"
            description="Show developer pages like the Shielded debug view."
            control={
              <SegmentedControl
                options={ADVANCED_MODE_OPTIONS}
                value={debugMode ? 'on' : 'off'}
                onChange={(value) => setDebugMode(value === 'on')}
              />
            }
          />
          <SettingsRow
            title="Log level"
            description="Choose how much detail is recorded in application logs."
            control={logLevelLoading ? (
              <Text size={12} color="brand" opacity={50}>Loading…</Text>
            ) : logLevel === null ? (
              <Button
                onClick={() => setLogLevelLoadAttempt((attempt) => attempt + 1)}
                variant="solid"
                colorScheme="primary-light"
                size="sm"
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
          <SettingsRow
            title="Application logs"
            description="Review diagnostic logs and save a file to share with support."
            actionLabel="View logs"
            onClick={() => navigate('/settings/logs')}
          />
          {debugMode && (
            <SettingsRow
              title="Asset lock recovery"
              description="Test page: look up an asset lock by txid and record it as a resumable funding."
              actionLabel="Open"
              onClick={() => navigate('/settings/asset-lock-recovery')}
            />
          )}
        </div>

        <SectionLabel>Connection</SectionLabel>
        <div className="flex flex-col">
          <SettingsRow
            title="Connection settings"
            description="Choose the wallet data source and manage P2P synchronization."
            actionLabel="Open Connection Settings"
            onClick={() => navigate('/connection-settings')}
          />
        </div>

        <SectionLabel>Danger zone</SectionLabel>
        <div className="flex flex-col">
          <SettingsRow
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
        setWalletToDelete={setWalletToDelete}
        refreshWallets={refreshWallets}
      />

      <ExportMnemonic
        isOpen={isMnemonicOpen}
        onClose={() => setIsMnemonicOpen(false)}
        walletId={walletId}
      />
    </div>
  )
}
