import { memo } from 'react'
import { Text, ExternalLinkIcon } from '@renderer/components/dash-ui-kit-enxtended'
import Checkbox from '@renderer/components/ui/Checkbox'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DashAmount from './DashAmount'
import UtxoLabelCell from './UtxoLabelCell'
import { WalletUtxoDto, Network } from '@renderer/api/types'
import { utxosPage, UTXO_GRID_TEMPLATE, UTXO_ID_EDGE_CHARS } from '@renderer/constants'
import { formatCreationDate, timePart } from '@renderer/utils/date'
import { transactionUrl, openExternal } from '@renderer/utils/explorer'
import { truncateMiddle } from '@renderer/utils/truncate'
import { utxoKey } from '@renderer/utils/utxo'

type UtxoRowProps = {
  utxo: WalletUtxoDto
  checked: boolean
  onToggle: (key: string) => void
  onSaveLabel: (txid: string, vout: number, label: string | null) => void
  network: Network | null
}

function UtxoRow({ utxo, checked, onToggle, onSaveLabel, network }: UtxoRowProps): React.JSX.Element {
  const { pendingBadge, explorerTitle } = utxosPage
  const date = new Date(utxo.blockTime * 1000)
  const toggle = (): void => onToggle(utxoKey(utxo.txid, utxo.vout))

  return (
    <div
      onClick={toggle}
      className={`${UTXO_GRID_TEMPLATE} px-[.9375rem] py-[.625rem] rounded-[.875rem] dash-block cursor-pointer`}
    >
      <span onClick={(e) => e.stopPropagation()} className={"flex items-center"}>
        <Checkbox checked={checked} onChange={toggle} label={null} />
      </span>

      {utxo.height === 0 ? (
        <span className={"flex"}>
          <CustomBadge text={pendingBadge} variant={"muted"} size={"xs"} />
        </span>
      ) : (
        <Text size={12} weight={"medium"} color={"brand"}>
          {formatCreationDate(date)} <span className={"opacity-50"}>{timePart(date)}</span>
        </Text>
      )}

      <div className={"flex items-center gap-[.3125rem] min-w-0"}>
        <Text size={12} weight={"medium"} color={"brand"} monospace className={"truncate"}>
          {truncateMiddle(utxo.txid, UTXO_ID_EDGE_CHARS)}
        </Text>
        <Text size={12} weight={"bold"} color={"brand"}>
          :{utxo.vout}
        </Text>
        <span onClick={(e) => e.stopPropagation()} className={"flex items-center gap-[.3125rem]"}>
          {network && (
            <button
              onClick={() => openExternal(transactionUrl(utxo.txid, network))}
              title={explorerTitle}
              className={"size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer"}
            >
              <ExternalLinkIcon size={12} color={"currentColor"} className={"dash-text-default opacity-50"} />
            </button>
          )}
          <CopyButton text={utxo.txid} />
        </span>
      </div>

      <div className={"min-w-0"}>
        <Text size={12} weight={"medium"} color={"brand"} monospace className={"truncate"}>
          {utxo.address}
        </Text>
      </div>

      <UtxoLabelCell label={utxo.label} onSave={(label) => onSaveLabel(utxo.txid, utxo.vout, label)} />

      <DashAmount duffs={BigInt(utxo.satoshis)} className={"text-right"} />
    </div>
  )
}

export default memo(UtxoRow)
