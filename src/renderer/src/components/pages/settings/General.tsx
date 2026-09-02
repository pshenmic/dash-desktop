import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '@renderer/api'
import type { CsvTxRow } from '@renderer/utils/csv'
import { transactionsToCsv } from '@renderer/utils/csv'
import { getErrorMessage } from '@renderer/utils/error'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useDebugMode, setDebugMode } from '@renderer/hooks/useDebugMode'
import { useWallets, refreshWallets } from '@renderer/hooks/useWallets'
import { Button, Input } from '@renderer/components/dash-ui-kit-enxtended'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { toast } from '@renderer/components/ui/Toast'
import { DEBUG_OPTIONS } from '@renderer/constants/settingsPage'
import SettingsDetailHeader from './SettingsDetailHeader'
import SettingsRow from './SettingsRow'
import SettingsSection from './SettingsSection'

export default function GeneralSettings(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null
  const wallets = useWallets()
  const debugMode = useDebugMode()
  const currentLabel = useMemo(
    () => wallets.find((wallet) => wallet.walletId === walletId)?.label ?? null,
    [wallets, walletId],
  )
  const [walletName, setWalletName] = useState('')
  const [renamePending, setRenamePending] = useState(false)
  const [exportPending, setExportPending] = useState(false)

  useEffect(() => {
    setWalletName(currentLabel ?? '')
  }, [currentLabel])

  const isUnchanged = walletName.trim() === (currentLabel ?? '')

  const handleRename = async (): Promise<void> => {
    if (!walletId || renamePending || isUnchanged) return
    setRenamePending(true)
    try {
      await API.setWalletLabel(walletId, walletName.trim())
      refreshWallets()
    } catch (error) {
      console.error('rename failed', error)
      toast.error(`**Rename failed** Could not update wallet name. ${getErrorMessage(error)}`)
    } finally {
      setRenamePending(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    if (!walletId || exportPending) return
    setExportPending(true)
    try {
      const raw = await API.getTransactions(walletId)
      const rows: CsvTxRow[] = (raw ?? []).map((transaction) => ({
        date: new Date(transaction.date),
        direction: transaction.direction === 1 ? 'in' : 'out',
        amountDuffs: transaction.transferAmount,
        address: transaction.address,
        txid: transaction.txid,
        status: transaction.status,
        confirmations: transaction.confirmations,
        blockHeight: transaction.blockHeight,
      }))
      if (rows.length === 0) {
        toast.error('**No transactions** Nothing to export yet.')
        return
      }
      const stamp = new Date().toISOString().slice(0, 10)
      await API.saveTextFile(
        `dash-transactions-${network ?? 'wallet'}-${stamp}.csv`,
        transactionsToCsv(rows),
      )
    } catch (error) {
      console.error('export failed', error)
      toast.error(`**Export failed** Could not export transactions. ${getErrorMessage(error)}`)
    } finally {
      setExportPending(false)
    }
  }

  return (
    <div className="w-full pb-12">
      <SettingsDetailHeader primary="General" secondary="Settings" />
      <div className="mt-8 px-12">
        <div className="max-w-[42rem]">
          <SettingsSection title="Wallet">
            <SettingsRow
              title="Wallet name"
              description="A label to identify this wallet across the app."
              control={(
                <div className="flex shrink-0 items-center gap-2">
                  <Input
                    id="wallet-name"
                    aria-label="Wallet name"
                    type="text"
                    placeholder="Wallet name"
                    value={walletName}
                    variant="outlined"
                    colorScheme="primary"
                    onChange={(event) => setWalletName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleRename()
                    }}
                    className="h-10 w-52 rounded-[.75rem] bg-transparent!"
                  />
                  <Button
                    type="button"
                    onClick={() => void handleRename()}
                    disabled={walletId === null || renamePending || isUnchanged}
                    variant="solid"
                    colorScheme="primary-light"
                    size="sm"
                    className="min-h-0! rounded-[.75rem]! px-4! py-2! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-brand"
                  >
                    {renamePending ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              )}
            />
            <SettingsRow
              title="Export transactions"
              description="Save this wallet's transaction history as a CSV file."
              actionLabel="Export CSV"
              pendingLabel="Exporting…"
              pending={exportPending}
              disabled={walletId === null}
              onClick={() => void handleExport()}
            />
          </SettingsSection>

          <SettingsSection title="Developer">
            <SettingsRow
              title="Debug mode"
              description="Show developer pages like the Shielded debug view."
              control={(
                <SegmentedControl
                  options={DEBUG_OPTIONS}
                  value={debugMode ? 'on' : 'off'}
                  onChange={(value) => setDebugMode(value === 'on')}
                />
              )}
            />
            <SettingsRow
              title="Application logs"
              description="Review diagnostic logs and save a file to share with support."
              actionLabel="View logs"
              onClick={() => navigate('/settings/logs')}
            />
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
