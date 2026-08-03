import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, Button } from '@renderer/components/dash-ui-kit-enxtended'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import Checkbox from '@renderer/components/ui/Checkbox'
import NoResults from '@renderer/components/ui/NoResults'
import SyncGateNotice from '@renderer/components/ui/SyncGateNotice'
import UtxoRow from './UtxoRow'
import UtxoSummary from './UtxoSummary'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useUtxos } from '@renderer/hooks/useUtxos'
import { utxosPage, UTXO_GRID_TEMPLATE } from '@renderer/constants'
import { utxoKey, totalDuffs, buildSendSelectedUrl, isDustUtxo } from '@renderer/utils/utxo'

export default function UtxoList({ coreGated = false }: { coreGated?: boolean }): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const network = status?.network ?? null
  const { utxos, loading, err } = useUtxos(walletId)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [dustFiltered, setDustFiltered] = useState(false)

  const { columns, buttons, errorMessage, emptyMessage, filterDust, dustEmptyMessage } = utxosPage

  const visibleUtxos = useMemo(
    () => (dustFiltered ? utxos.filter((utxo) => !isDustUtxo(utxo)) : utxos),
    [utxos, dustFiltered]
  )
  const selectedUtxos = useMemo(
    () => visibleUtxos.filter((utxo) => selected.has(utxoKey(utxo.txid, utxo.vout))),
    [visibleUtxos, selected]
  )

  const toggle = useCallback((key: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const renderRows = (): React.JSX.Element => {
    if (loading) {
      return <ListSkeleton rows={6} rowClassName={"h-[2.5rem] rounded-[.875rem]"} />
    }
    if (err) {
      return <NoResults noResults={errorMessage} />
    }
    if (utxos.length === 0) {
      return <NoResults noResults={emptyMessage} />
    }
    if (visibleUtxos.length === 0) {
      return <NoResults noResults={dustEmptyMessage} />
    }
    return (
      <div className={"flex flex-col gap-[.625rem]"}>
        {visibleUtxos.map((utxo) => {
          const key = utxoKey(utxo.txid, utxo.vout)
          return (
            <UtxoRow key={key} utxo={utxo} checked={selected.has(key)} onToggle={toggle} network={network} />
          )
        })}
      </div>
    )
  }

  return (
    <div className={"px-12 pb-8"}>
      <div className={`
        relative
        flex
        flex-col
        gap-5
        p-[.9375rem]
        rounded-3xl
        dash-card-base
        shadow-[0_0_32px_0_rgba(12,28,51,0.08)]
      `}>
        {coreGated ? (
          <SyncGateNotice />
        ) : (
          <>
            <UtxoSummary
              utxos={utxos}
              selectedCount={selectedUtxos.length}
              selectedDuffs={totalDuffs(selectedUtxos)}
            />

            <div className={"flex flex-col gap-[.625rem]"}>
              <div className={`${UTXO_GRID_TEMPLATE} px-[.9375rem]`}>
                <span />
                {[columns.date, columns.output, columns.address, columns.label, columns.value].map((column, index) => (
                  <Text
                    key={column}
                    size={12}
                    weight={"medium"}
                    color={"brand"}
                    opacity={50}
                    className={index === 4 ? 'text-right' : undefined}
                  >
                    {column}
                  </Text>
                ))}
              </div>
              {renderRows()}
            </div>

            <div className={"flex items-center gap-2"}>
              <Button
                type={"button"}
                onClick={() => setSelected(new Set(visibleUtxos.map((utxo) => utxoKey(utxo.txid, utxo.vout))))}
                disabled={loading || visibleUtxos.length === 0}
                variant={"solid"}
                colorScheme={"primary-light"}
                size={"sm"}
                className={"min-h-0! py-2! rounded-[.75rem]"}
              >
                {buttons.selectAll}
              </Button>
              <Button
                type={"button"}
                onClick={() => setSelected(new Set())}
                disabled={selectedUtxos.length === 0}
                variant={"solid"}
                colorScheme={"primary-light"}
                size={"sm"}
                className={"min-h-0! py-2! rounded-[.75rem]"}
              >
                {buttons.clear}
              </Button>
              <Button
                type={"button"}
                onClick={() => navigate(buildSendSelectedUrl(selectedUtxos.map((utxo) => utxoKey(utxo.txid, utxo.vout))))}
                disabled={selectedUtxos.length === 0}
                variant={"solid"}
                colorScheme={"primary"}
                size={"sm"}
                className={"min-h-0! py-2! rounded-[.75rem]"}
              >
                {buttons.sendSelected}
              </Button>
              <Checkbox
                checked={dustFiltered}
                onChange={setDustFiltered}
                label={<Text size={12} weight={"medium"} color={"brand"}>{filterDust}</Text>}
                className={"ml-auto"}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
