import { ChevronIcon } from 'dash-ui-kit/react'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CopyableError from '@renderer/components/ui/CopyableError'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Spinner from '@renderer/components/ui/Spinner'
import { SEND_PREVIEW_ROLE_LABELS } from '@renderer/constants/sendTransactionPreview'
import type { SendPreviewAmountProps, SendPreviewRowsProps, SendTransactionPreviewProps } from '@renderer/types/SendTransactionPreview'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useFiat } from '@renderer/hooks/useFiat'
import { creditsToDuffs, davToDash } from '@renderer/utils/balance'

function PreviewAmount({amount, unit}: SendPreviewAmountProps): React.JSX.Element {
  const {format, rateReady} = useFiat()
  if (unit === 'credits') return <CreditsAmount credits={amount} exact align="end" />
  return <span className="inline-flex flex-col items-end">
    <span className="whitespace-nowrap"><DashBigNumber>{davToDash(amount)}</DashBigNumber> Dash</span>
    {rateReady && <span className="text-[.625rem] font-medium dash-text-primary">~ {format(amount)}</span>}
  </span>
}

function PreviewRows({rows}: SendPreviewRowsProps): React.JSX.Element {
  return <div className="flex flex-col gap-3">
    {rows.map((row, index) => (
      <div key={index} className="dash-block rounded-xl p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            <Text size={14} weight="medium" color="brand" className="font-mono break-all min-w-0">{row.addressLabel}</Text>
            {row.address && <span className="shrink-0 pt-0.5"><CopyButton text={row.address} /></span>}
          </div>
          <Text size={14} weight="extrabold" color="brand" className="shrink-0">
            <PreviewAmount amount={row.amount} unit={row.unit} />
          </Text>
        </div>
        {(row.reference || SEND_PREVIEW_ROLE_LABELS[row.role]) && <div className="flex flex-wrap items-center gap-2">
          {SEND_PREVIEW_ROLE_LABELS[row.role] && <CustomBadge text={SEND_PREVIEW_ROLE_LABELS[row.role]!} variant="muted" size="xs" />}
          {row.reference && <div className="flex items-start gap-1.5 min-w-0">
            <Text size={12} weight="medium" color="brand" opacity={50} className="font-mono break-all">{row.reference}</Text>
            <span className="shrink-0"><CopyButton text={row.reference} /></span>
          </div>}
        </div>}
      </div>
    ))}
  </div>
}

export default function SendTransactionPreview({
  data, loading, error, valid, canRefresh, onBack, onRetry, onSign,
}: SendTransactionPreviewProps): React.JSX.Element {
  const {status} = useAuth()
  return <div className="flex-1 min-h-0 overflow-y-auto px-6 xl:px-12 pt-2 pb-6">
    <div className="flex items-center gap-4 mb-6">
      <button type="button" onClick={onBack} aria-label="Back to send" className="flex size-12 shrink-0 items-center justify-center rounded-[.9375rem] dash-block dash-black-border hover:opacity-70 cursor-pointer">
        <ChevronIcon size={17} className="dash-text-default rotate-90" />
      </button>
      <Text size={40} weight="medium" color="brand" className="tracking-[-0.03em]">Transaction details</Text>
    </div>
    <div className="mx-auto max-w-280 flex flex-col gap-4" aria-busy={loading}>
      {loading && <div role="status" className="dash-card-base rounded-[.9375rem] p-6 flex items-center gap-3">
        <Spinner size={20} className="dash-text-primary" />
        <Text size={14} weight="medium" color="brand">Preparing transaction preview…</Text>
      </div>}
      {error && <div role="alert" className="dash-card-base rounded-[.9375rem] p-4"><CopyableError message={error} /></div>}
      {data && <>
        <section className="dash-card-base rounded-[.9375rem] p-4 flex flex-col gap-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between gap-4">
            <Text size={16} weight="extrabold" color="brand">{data.title}</Text>
            <CustomBadge text="Unsigned" variant="muted" size="xs" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="dash-block rounded-xl p-3 flex flex-col gap-1"><Text size={12} weight="medium" color="brand" opacity={50}>From</Text><Text size={14} weight="medium" color="brand" className="break-all">{data.from}</Text></div>
            <div className="dash-block rounded-xl p-3 flex justify-between items-center gap-3">
              <Text size={14} weight="medium" color="brand">Recipients receive</Text>
              <Text size={14} weight="extrabold" color="brand"><PreviewAmount amount={data.isCoreOperation ? creditsToDuffs(data.amountCredits) : data.amountCredits} unit={data.isCoreOperation ? 'duffs' : 'credits'} /></Text>
            </div>
            {data.fees.map(fee => <div key={fee.unit} className="dash-block rounded-xl p-3 flex justify-between items-center gap-3">
              <Text size={14} weight="medium" color="brand">{fee.label}</Text>
              <Text size={14} weight="medium" color="brand"><PreviewAmount amount={fee.amount} unit={fee.unit} /></Text>
            </div>)}
            <div className="dash-block rounded-xl p-3 flex justify-between items-center gap-3">
              <Text size={14} weight="medium" color="brand">Total debit</Text>
              <Text size={16} weight="extrabold" color="brand"><PreviewAmount amount={data.isCoreOperation ? creditsToDuffs(data.totalDebitCredits) : data.totalDebitCredits} unit={data.isCoreOperation ? 'duffs' : 'credits'} /></Text>
            </div>
          </div>
          <Text size={12} weight="medium" color="brand" opacity={50}>Network: {status?.network}</Text>
        </section>
        <section className="dash-card-base rounded-[.9375rem] p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2"><Text size={14} weight="medium" color="brand">Inputs</Text><CustomBadge text={String(data.inputs.length)} variant="muted" size="xs" /></div>
          <PreviewRows rows={data.inputs} />
        </section>
        <section className="dash-card-base rounded-[.9375rem] p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Text size={14} weight="medium" color="brand">Outputs</Text>
            {data.outputGroups.length === 1 && <CustomBadge text={String(data.outputGroups[0].rows.length)} variant="muted" size="xs" />}
          </div>
          {data.outputGroups.map((group, index) => <div key={index} className="flex flex-col gap-3">
            {group.title && <div className="flex items-center gap-2"><Text size={12} weight="medium" color="brand" opacity={50}>{group.title}</Text><CustomBadge text={String(group.rows.length)} variant="muted" size="xs" /></div>}
            <PreviewRows rows={group.rows} />
          </div>)}
        </section>
        {data.unsignedHex != null && <details className="dash-card-base rounded-[.9375rem] p-4">
          <summary className="cursor-pointer text-sm font-medium dash-text-default">{data.unsignedLabel}</summary>
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex items-center justify-between gap-3">
              <Text size={12} weight="medium" color="brand" opacity={50}>Unsigned hex</Text>
              <CopyButton text={data.unsignedHex} />
            </div>
            <textarea readOnly value={data.unsignedHex} aria-label={data.unsignedLabel} rows={5} className="w-full resize-y rounded-xl p-3 dash-block dash-text-default font-mono text-xs break-all outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-white/40" />
          </div>
        </details>}
      </>}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" onClick={onBack} variant="outline" colorScheme="primary-light" size="md" className="rounded-xl">Back to send</Button>
        {!loading && !valid && <Button type="button" onClick={onRetry} disabled={!canRefresh} variant="outline" colorScheme="primary-light" size="md" className="rounded-xl">Refresh preview</Button>}
        <Button type="button" onClick={onSign} disabled={!valid || loading || !data} size="md" className="rounded-xl">Sign &amp; Send</Button>
      </div>
    </div>
  </div>
}
