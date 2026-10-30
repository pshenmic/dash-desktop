import { Button, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import PageHeader from '@renderer/components/ui/PageHeader'
import Spinner from '@renderer/components/ui/Spinner'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SEND_PREVIEW_LABELS, SEND_PREVIEW_ROLE_LABELS } from '@renderer/constants/sendTransactionPreview'
import { SURFACE_PANEL, SURFACE_ROW } from '@renderer/constants/surfaces'
import { TRANSACTION_DETAIL_IDENTIFIER_CLASS } from '@renderer/constants/transactionsPage'
import { TRANSFER_WIZARD_CTA_CLASS } from '@renderer/constants/transferWizard'
import type { SendPreviewAmountProps, SendPreviewRowsProps, SendTransactionPreviewProps } from '@renderer/types/SendTransactionPreview'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useFiat } from '@renderer/hooks/useFiat'
import { useErrorToast } from '@renderer/hooks/useErrorToast'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { creditsToDuffs, davToDash } from '@renderer/utils/balance'

function PreviewAmount({amount, unit}: SendPreviewAmountProps): React.JSX.Element {
  const {format, rateReady} = useFiat()
  if (unit === 'credits') return <CreditsAmount credits={amount} exact align="end" />
  return <span className="inline-flex flex-col items-end">
    <span className="whitespace-nowrap"><DashBigNumber>{davToDash(amount)}</DashBigNumber><span className="font-normal"> Dash</span></span>
    {rateReady && <span className="text-[.625rem] font-medium dash-text-primary">{formatApproxFiat(format(amount))}</span>}
  </span>
}

function PreviewRows({rows}: SendPreviewRowsProps): React.JSX.Element {
  return <div className="flex flex-col gap-3">
    {rows.map((row, index) => (
      <div key={index} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${SURFACE_ROW}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {row.address
              ? <HighlightedIdentifier className={TRANSACTION_DETAIL_IDENTIFIER_CLASS}>{row.address}</HighlightedIdentifier>
              : <Text size={14} weight="medium" color="brand" className="min-w-0">{row.addressLabel}</Text>}
            {row.address && <CopyButton text={row.address} className="shrink-0" />}
          </div>
          {(row.reference || SEND_PREVIEW_ROLE_LABELS[row.role]) && <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {SEND_PREVIEW_ROLE_LABELS[row.role] && <CustomBadge text={SEND_PREVIEW_ROLE_LABELS[row.role]!} variant="muted" size="xs" />}
            {row.reference && <>
              <Text size={12} weight="medium" color="brand" opacity={50} className="min-w-0 font-mono break-all">{row.reference}</Text>
              <CopyButton text={row.reference} className="shrink-0" />
            </>}
          </div>}
        </div>
        <Text size={14} weight="extrabold" color="brand" className="shrink-0">
          <PreviewAmount amount={row.amount} unit={row.unit} />
        </Text>
      </div>
    ))}
  </div>
}

export default function SendTransactionPreview({
  data, loading, error, valid, canRefresh, onBack, onRetry, onSign,
}: SendTransactionPreviewProps): React.JSX.Element {
  const {status} = useAuth()
  useErrorToast(error)
  return <div className="flex-1 min-h-0 flex flex-col overflow-y-auto -mt-1 pt-1 px-12 pb-8">
    <PageHeader
      title={PAGE_HEADERS.sendPreview.title}
      onBack={onBack}
      backLabel={PAGE_HEADERS.sendPreview.back}
      titleAddon={loading && <span role="status" aria-label={SEND_PREVIEW_LABELS.preparing} className="flex items-center"><Spinner size={20} className="dash-text-primary" /></span>}
    />
    <div className="flex flex-1 flex-col gap-4" aria-busy={loading}>
      {data && <>
        <section className={`flex flex-col gap-4 ${SURFACE_PANEL}`}>
          <div className="flex items-center justify-between gap-4">
            <Text size={16} weight="extrabold" color="brand">{data.title}</Text>
            <CustomBadge text={SEND_PREVIEW_LABELS.unsigned} variant="muted" size="xs" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`flex flex-col gap-1 ${SURFACE_ROW}`}><Text size={12} weight="medium" color="brand" opacity={50}>{SEND_PREVIEW_LABELS.from}</Text>{data.fromAddress
              ? <HighlightedIdentifier className={TRANSACTION_DETAIL_IDENTIFIER_CLASS}>{data.fromAddress}</HighlightedIdentifier>
              : <Text size={14} weight="medium" color="brand" className="break-all">{data.from}</Text>}</div>
            <div className={`flex justify-between items-center gap-3 ${SURFACE_ROW}`}>
              <Text size={14} weight="medium" color="brand">{SEND_PREVIEW_LABELS.recipientsReceive}</Text>
              <Text size={14} weight="extrabold" color="brand"><PreviewAmount amount={data.isCoreOperation ? creditsToDuffs(data.amountCredits) : data.amountCredits} unit={data.isCoreOperation ? 'duffs' : 'credits'} /></Text>
            </div>
            {data.fees.map(fee => <div key={fee.unit} className={`flex justify-between items-center gap-3 ${SURFACE_ROW}`}>
              <Text size={14} weight="medium" color="brand">{fee.label}</Text>
              <Text size={14} weight="medium" color="brand"><PreviewAmount amount={fee.amount} unit={fee.unit} /></Text>
            </div>)}
            <div className={`flex justify-between items-center gap-3 ${SURFACE_ROW}`}>
              <Text size={14} weight="medium" color="brand">{SEND_PREVIEW_LABELS.totalDebit}</Text>
              <Text size={16} weight="extrabold" color="brand"><PreviewAmount amount={data.isCoreOperation ? creditsToDuffs(data.totalDebitCredits) : data.totalDebitCredits} unit={data.isCoreOperation ? 'duffs' : 'credits'} /></Text>
            </div>
          </div>
          <Text size={12} weight="medium" color="brand" opacity={50}>{SEND_PREVIEW_LABELS.network}: {status?.network}</Text>
        </section>
        <section className={`flex flex-col gap-4 ${SURFACE_PANEL}`}>
          <div className="flex items-center gap-2"><Text size={14} weight="medium" color="brand">{SEND_PREVIEW_LABELS.inputs}</Text><CustomBadge text={String(data.inputs.length)} variant="muted" size="xs" /></div>
          <PreviewRows rows={data.inputs} />
        </section>
        <section className={`flex flex-col gap-4 ${SURFACE_PANEL}`}>
          <div className="flex items-center gap-2">
            <Text size={14} weight="medium" color="brand">{SEND_PREVIEW_LABELS.outputs}</Text>
            {data.outputGroups.length === 1 && <CustomBadge text={String(data.outputGroups[0].rows.length)} variant="muted" size="xs" />}
          </div>
          {data.outputGroups.map((group, index) => <div key={index} className="flex flex-col gap-3">
            {group.title && <div className="flex items-center gap-2"><Text size={12} weight="medium" color="brand" opacity={50}>{group.title}</Text><CustomBadge text={String(group.rows.length)} variant="muted" size="xs" /></div>}
            <PreviewRows rows={group.rows} />
          </div>)}
        </section>
        {data.unsignedHex != null && <details className={SURFACE_PANEL}>
          <summary className="cursor-pointer text-sm font-medium dash-text-default">{data.unsignedLabel}</summary>
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex items-center justify-between gap-3">
              <Text size={12} weight="medium" color="brand" opacity={50}>{SEND_PREVIEW_LABELS.unsignedHex}</Text>
              <CopyButton text={data.unsignedHex} />
            </div>
            <textarea readOnly value={data.unsignedHex} aria-label={data.unsignedLabel} rows={5} className={`w-full resize-y ${SURFACE_ROW} dash-text-default font-mono text-xs break-all outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-white/40`} />
          </div>
        </details>}
      </>}
      <div className="mt-auto pt-4 flex gap-2">
        <Button type="button" onClick={onBack} variant="outline" colorScheme="primary-light" size="md" className={TRANSFER_WIZARD_CTA_CLASS}>{PAGE_HEADERS.sendPreview.back}</Button>
        {!loading && !valid && <Button type="button" onClick={onRetry} disabled={!canRefresh} colorScheme="lightBlue-mint" size="md" className={TRANSFER_WIZARD_CTA_CLASS}>{SEND_PREVIEW_LABELS.refresh}</Button>}
        <Button type="button" onClick={onSign} disabled={!valid || loading || !data} colorScheme="primary" size="md" className={TRANSFER_WIZARD_CTA_CLASS}>{SEND_PREVIEW_LABELS.sign}</Button>
      </div>
    </div>
  </div>
}
