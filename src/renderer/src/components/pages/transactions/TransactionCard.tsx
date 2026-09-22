import AmountSummary from "@renderer/components/ui/AmountSummary"
import SensitiveValue from "@renderer/components/ui/SensitiveValue"
import TransactionCardIcons from "./TransactionCardIcons"
import CustomBadge from "@renderer/components/ui/CustomBadge"
import { formatCreationDate, timePart } from "@renderer/utils/date"
import DashBigNumber from "@renderer/components/ui/DashBigNumber"
import CreditsAmount from "@renderer/components/ui/CreditsAmount"
import { TimeDelta } from "dash-ui-kit/react"
import { cva } from "class-variance-authority"
import { Text, ExternalLinkIcon } from "@renderer/components/dash-ui-kit-enxtended"
import type { TransactionCardItem } from "@renderer/types/WalletTransaction"
import { formatTransactionCardAmount } from "@renderer/utils/walletTransactions"
import { useFiat } from "@renderer/hooks/useFiat"
import { useBalanceVisibility } from "@renderer/hooks/useBalanceVisibility"
import { useAuth } from "@renderer/contexts/AuthContext"
import { transactionUrl, platformTransactionUrl, openExternal } from "@renderer/utils/explorer"
import { transactionsPage } from "@renderer/constants"
import { TRANSACTION_CARD_SIGNS, TRANSACTION_CARD_STATUS_VARIANTS } from '@renderer/constants/transactionsPage'

const transactionCardStyles = cva(
  `
    relative
    group
    flex
    items-center
    gap-4
    px-[.9375rem]
    py-[.625rem]
    rounded-[.875rem]
    dash-block
  `,
  {
    variants: {
      status: {
        failed: 'bg-dash-red-5 dark:bg-dash-red-15',
        success: '',
        pending: '',
        unknown: '',
      },
    },
  },
)

export default function TransactionCard({
  id,
  status,
  kind,
  title,
  subtitleLabel,
  labelValue,
  amount,
  date,
  direction
} : TransactionCardItem): React.JSX.Element {
  let variantAmountSummary = TRANSACTION_CARD_STATUS_VARIANTS[status]
  if (kind === undefined && status !== 'failed') variantAmountSummary = 'muted'
  const isIncoming = direction === 'in'
  const { format: formatFiat, rateReady } = useFiat()
  const { isBalanceVisible } = useBalanceVisibility()
  const { status: appStatus } = useAuth()
  const network = appStatus?.network ?? null
  const formattedAmount = formatTransactionCardAmount({ amount, kind })
  const explorerUrl = kind === 'platform' ? platformTransactionUrl : transactionUrl

  return (
    <div className={transactionCardStyles({ status })} title={status === 'unknown' ? 'Status unavailable' : undefined}>
      <div className={network ? 'shrink-0 group-hover:opacity-0 group-focus-within:opacity-0' : 'shrink-0'}>
        <TransactionCardIcons status={status} />
      </div>
      <div className={"flex-1 min-w-0 flex flex-col gap-[.25rem]"}>
        <div className={"flex min-w-0 items-center gap-[.3125rem]"} title={title}>
          <CustomBadge text={kind ?? ''} variant={variantAmountSummary} size={"s"} className={"shrink-0"} />
          <Text reset size={12} weight={"medium"} color={"brand"} className={"min-w-0 truncate leading-[120%]"}>
            {title}
          </Text>
        </div>

        <div className={"min-w-0"} title={`${subtitleLabel}: ${labelValue}`}>
          <Text reset size={10} weight={"light"} color={"brand"} opacity={30} className={"block truncate"}>
            {subtitleLabel}: {labelValue}
          </Text>
        </div>

        <div
          className={"flex min-w-0 items-center gap-[.25rem]"}
          title={id}
          aria-label={`${transactionsPage.detail.transactionId}: ${id}`}
        >
          <Text size={10} weight={"light"} color={"brand"} opacity={30} className={"shrink-0"}>
            {transactionsPage.detail.transactionId}:
          </Text>
          <Text
            reset
            size={10}
            weight={"medium"}
            color={"brand"}
            opacity={50}
            className={"min-w-0 truncate font-mono"}
          >
            {id}
          </Text>
        </div>
      </div>

      <AmountSummary
        total={
          <SensitiveValue hidden={!isBalanceVisible} size={"card"}>
            <span className={isIncoming ? 'text-dash-brand dark:text-dash-mint' : ""}>
              {kind === 'platform' ? (
                <CreditsAmount
                  credits={amount}
                  prefix={TRANSACTION_CARD_SIGNS[direction]}
                  exact
                  showFiat={false}
                  align={'end'}
                  unitClassName={'font-medium'}
                />
              ) : (
                <>{TRANSACTION_CARD_SIGNS[direction]}<DashBigNumber>{formattedAmount.value}</DashBigNumber></>
              )}
            </span>
          </SensitiveValue>
        }
        textBadge={isBalanceVisible && rateReady ? `~ ${formatFiat(formattedAmount.duffs)}` : ''}
        variant={variantAmountSummary}
        currency={isBalanceVisible && kind !== 'platform' ? 'Dash' : ''}
        date={
          date ? <>
            {formatCreationDate(date)} {timePart(date)} (<TimeDelta endDate={date}/>)
          </> : 'Date unavailable'
        }
      />

      {network && (
        <div
          className={`
            absolute left-[.625rem] top-1/2 -translate-y-1/2
            opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
            pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto
            transition-opacity duration-200 ease-out
          `}
        >
          <button
            onClick={(e) => { e.stopPropagation(); openExternal(explorerUrl(id, network)) }}
            title={"Open in explorer"}
            className={`
              size-7 rounded-[.5rem] flex items-center justify-center
              dash-block-5 dash-black-border cursor-pointer
              hover:scale-105 transition-transform duration-200
            `}
          >
            <ExternalLinkIcon size={14} color={"currentColor"} className={"dash-text-default opacity-70"} />
          </button>
        </div>
      )}
    </div>
  )
}
