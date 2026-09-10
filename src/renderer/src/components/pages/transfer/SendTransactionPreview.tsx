import { ChevronIcon } from 'dash-ui-kit/react'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import type { SendPreviewAmountProps, SendPreviewRowsProps, SendTransactionPreviewProps } from '@renderer/types/SendTransactionPreview'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useFiat } from '@renderer/hooks/useFiat'
import { creditsToDuffs, davToDash } from '@renderer/utils/balance'

function PreviewAmount({credits, isCoreOperation}: SendPreviewAmountProps): React.JSX.Element {
  const {format, rateReady} = useFiat()
  if (!isCoreOperation) return <CreditsAmount credits={credits} exact align="end" />
  const duffs = creditsToDuffs(credits)
  return <span className="inline-flex flex-col items-end">
    <span className="whitespace-nowrap"><DashBigNumber>{davToDash(duffs)}</DashBigNumber> Dash</span>
    {rateReady && <span className="text-[.625rem] font-medium dash-text-primary">~ {format(duffs)}</span>}
  </span>
}

function PreviewRows({rows, isCoreOperation}: SendPreviewRowsProps): React.JSX.Element {
  return <div className="flex flex-col gap-3">
    {rows.map((row, index) => (
      <div key={index} className="dash-block rounded-xl p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            <Text size={14} weight="medium" color="brand" className="font-mono break-all min-w-0">{row.address || row.label}</Text>
            {row.address && <span className="shrink-0 pt-0.5"><CopyButton text={row.address} /></span>}
          </div>
          {row.amountCredits != null && <Text size={14} weight="extrabold" color="brand" className="shrink-0">
            <PreviewAmount credits={row.amountCredits} isCoreOperation={isCoreOperation} />
          </Text>}
        </div>
        {(row.reference || (row.label && row.address)) && <div className="flex flex-wrap items-center gap-2">
          {row.label && row.address && <CustomBadge text={row.label} variant="muted" size="xs" />}
          {row.reference && <Text size={12} weight="medium" color="brand" opacity={50} className="font-mono break-all">{row.reference}</Text>}
        </div>}
      </div>
    ))}
  </div>
}

export default function SendTransactionPreview({
  data, valid, canRefresh, onBack, onRetry, onSign,
}: SendTransactionPreviewProps): React.JSX.Element {
  const {status} = useAuth()
  return <div className="flex-1 min-h-0 overflow-y-auto px-6 xl:px-12 pt-2 pb-6">
    <div className="flex items-center gap-4 mb-6">
      <button type="button" onClick={onBack} aria-label="Back to send" className="flex size-12 shrink-0 items-center justify-center rounded-[.9375rem] dash-block dash-black-border hover:opacity-70 cursor-pointer">
        <ChevronIcon size={17} className="dash-text-default rotate-90" />
      </button>
      <Text size={40} weight="medium" color="brand" className="tracking-[-0.03em]">Transaction details</Text>
    </div>
    <div className="mx-auto max-w-280 flex flex-col gap-4">
        <section className="dash-card-base rounded-[.9375rem] p-4 flex flex-col gap-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between gap-4">
            <Text size={16} weight="extrabold" color="brand">{data.title}</Text>
            <CustomBadge text="Unsigned" variant="muted" size="xs" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="dash-block rounded-xl p-3 flex flex-col gap-1"><Text size={12} weight="medium" color="brand" opacity={50}>From</Text><Text size={14} weight="medium" color="brand" className="break-all">{data.from}</Text></div>
            <div className="dash-block rounded-xl p-3 flex justify-between items-center gap-3"><Text size={14} weight="medium" color="brand">{data.receivedIsEstimate ? 'Estimated recipients receive' : 'Recipients receive'}</Text><Text size={14} weight="extrabold" color="brand"><PreviewAmount credits={data.amountCredits} isCoreOperation={data.isCoreOperation} /></Text></div>
            <div className="dash-block rounded-xl p-3 flex justify-between items-center gap-3"><Text size={14} weight="medium" color="brand">Estimated network fee</Text><Text size={14} weight="medium" color="brand"><PreviewAmount credits={data.feeCredits} isCoreOperation={data.isCoreOperation} /></Text></div>
            <div className="dash-block rounded-xl p-3 flex justify-between items-center gap-3"><Text size={14} weight="medium" color="brand">Total debit</Text><Text size={16} weight="extrabold" color="brand"><PreviewAmount credits={data.totalDebitCredits} isCoreOperation={data.isCoreOperation} /></Text></div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Text size={12} weight="medium" color="brand" opacity={50}>Network: {status?.network}</Text>
          </div>
        </section>
        <section className="dash-card-base rounded-[.9375rem] p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2"><Text size={14} weight="medium" color="brand">Inputs</Text>{data.inputs.length > 0 && <CustomBadge text={String(data.inputs.length)} variant="muted" size="xs" />}</div>
          <PreviewRows rows={data.inputs} isCoreOperation={data.isCoreOperation} />
          {data.inputNote && <Text size={12} weight="medium" color="brand" opacity={50}>{data.inputNote}</Text>}
        </section>
        <section className="dash-card-base rounded-[.9375rem] p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2"><Text size={14} weight="medium" color="brand">Outputs</Text><CustomBadge text={String(data.outputs.length)} variant="muted" size="xs" /></div>
          <PreviewRows rows={data.outputs} isCoreOperation={data.isCoreOperation} />
          {data.outputNote && <Text size={12} weight="medium" color="brand" opacity={50}>{data.outputNote}</Text>}
        </section>
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" onClick={onBack} variant="outline" colorScheme="primary-light" size="md" className="rounded-xl">Back to send</Button>
        {!valid && <Button type="button" onClick={onRetry} disabled={!canRefresh} variant="outline" colorScheme="primary-light" size="md" className="rounded-xl">Refresh preview</Button>}
        <Button type="button" onClick={onSign} disabled={!valid} size="md" className="rounded-xl">Sign &amp; Send</Button>
      </div>
    </div>
  </div>
}
