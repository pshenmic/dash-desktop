import { useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Button, Heading, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { toast } from '@renderer/components/ui/Toast'
import { useFiat } from '@renderer/hooks/useFiat'
import { useThemePreference, setThemePreference } from '@renderer/hooks/useThemeController'
import { ThemePreference } from '@renderer/utils/theme'
import { transactionsToCsv, CsvTxRow } from '@renderer/utils/csv'
import { WalletTxDto } from '@renderer/hooks/useWalletTransactions'
import { useWallets, refreshWallets } from '@renderer/hooks/useWallets'

interface SettingsRowProps {
  title: string
  description: string
  control?: React.ReactNode
  actionLabel?: string
  pendingLabel?: string
  pending?: boolean
  disabled?: boolean
  destructive?: boolean
  onClick?: () => void
}

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

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const CURRENCY_OPTIONS = [
  { value: 'usd', label: 'USD' },
  { value: 'eur', label: 'EUR' },
  { value: 'btc', label: 'BTC' },
  { value: 'rub', label: 'RUB' },
]

export default function Settings(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null

  const themePreference = useThemePreference()
  const { currency, setCurrency } = useFiat()

  const [restartPending, setRestartPending] = useState(false)
  const [clearPending, setClearPending] = useState(false)
  const [exportPending, setExportPending] = useState(false)

  const wallets = useWallets()
  const currentLabel = useMemo(
    () => wallets.find((w) => w.walletId === walletId)?.label ?? null,
    [wallets, walletId],
  )

  const [walletName, setWalletName] = useState('')
  const [renamePending, setRenamePending] = useState(false)

  useEffect(() => {
    setWalletName(currentLabel ?? '')
  }, [currentLabel])

  const isUnchanged = walletName.trim() === (currentLabel ?? '')

  const handleRename = async (): Promise<void> => {
    if (!walletId || renamePending || isUnchanged) return
    setRenamePending(true)
    try {
      const res = await API.setWalletLabel(walletId, walletName.trim())
      if (res.success) {
        refreshWallets()
      } else if (res.errorMessage) {
        toast.error(`**Rename failed** ${res.errorMessage}`)
      }
    } catch (err) {
      console.error('rename failed', err)
      toast.error('**Rename failed** Could not update wallet name.')
    } finally {
      setRenamePending(false)
    }
  }

  const handleRestart = async (): Promise<void> => {
    if (!walletId || restartPending) return
    setRestartPending(true)
    try {
      await API.stopWalletSync()
      await API.startWalletSync(walletId)
    } catch (err) {
      console.error('restart sync failed', err)
    } finally {
      setRestartPending(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    if (!network || clearPending) return
    const ok = window.confirm(
      `Clear all sync cache for ${network}? This deletes downloaded headers, filters and wallet transaction history. The wallet itself is not affected.`,
    )
    if (!ok) return
    setClearPending(true)
    try {
      await API.resetWalletSync(network)
    } catch (err) {
      console.error('reset sync failed', err)
    } finally {
      setClearPending(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    if (!walletId || exportPending) return
    setExportPending(true)
    try {
      const raw = (await API.getTransactions(walletId)) as WalletTxDto[]
      const rows: CsvTxRow[] = (raw ?? []).map((tx) => ({
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
      const res = await API.saveTextFile(`dash-transactions-${network ?? 'wallet'}-${stamp}.csv`, csv)
      if (!res.success && res.errorMessage) {
        toast.error(`**Export failed** ${res.errorMessage}`)
      }
    } catch (err) {
      console.error('export failed', err)
      toast.error('**Export failed** Could not read transactions.')
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
                >
                  {renamePending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            }
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
        </div>

        <SectionLabel>Currency</SectionLabel>
        <div className="flex flex-col">
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

        <SectionLabel>Data</SectionLabel>
        <div className="flex flex-col">
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

        <SectionLabel>Sync</SectionLabel>
        <div className="flex flex-col">
          <SettingsRow
            title="Restart sync"
            description="Stop and start the P2P sync for the current wallet."
            actionLabel="Restart"
            pendingLabel="Restarting…"
            pending={restartPending}
            disabled={walletId === null}
            onClick={handleRestart}
          />
          <SettingsRow
            title="Clear sync data"
            description="Delete downloaded headers, filters, and transaction history for the current network. The wallet is preserved."
            actionLabel="Clear sync data"
            pendingLabel="Clearing…"
            pending={clearPending}
            disabled={network === null}
            destructive
            onClick={handleClear}
          />
        </div>
      </div>
    </div>
  )
}
