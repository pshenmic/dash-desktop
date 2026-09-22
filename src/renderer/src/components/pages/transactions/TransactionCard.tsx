import AmountSummary from "@renderer/components/ui/AmountSummary"
import SensitiveValue from "@renderer/components/ui/SensitiveValue"
import TransactionCardIcons from "./TransactionCardIcons"
import CustomBadge from "@renderer/components/ui/CustomBadge"
import { formatCreationDate, timePart } from "@renderer/utils/date"
import DashBigNumber from "@renderer/components/ui/DashBigNumber"
import CreditsAmount from "@renderer/components/ui/CreditsAmount"
import { TimeDelta } from "dash-ui-kit/react"
import { cva } from "class-variance-authority"
import { Text, Tooltip } from "@renderer/components/dash-ui-kit-enxtended"
import type { TransactionCardProps } from "@renderer/types/WalletTransaction"
import { formatTransactionCardAmount } from "@renderer/utils/walletTransactions"
import { useFiat } from "@renderer/hooks/useFiat"
import { useBalanceVisibility } from "@renderer/hooks/useBalanceVisibility"
import { transactionsPage } from "@renderer/constants"
import { TRANSACTION_CARD_SIGNS, TRANSACTION_CARD_STATUS_VARIANTS } from '@renderer/constants/transactionsPage'

const transactionCardStyles = cva(
  `
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
  direction,
  fullIdentifiers = false
} : TransactionCardProps): React.JSX.Element {
  let variantAmountSummary = TRANSACTION_CARD_STATUS_VARIANTS[status]
  if (kind === undefined && status !== 'failed') variantAmountSummary = 'muted'
  const isIncoming = direction === 'in'
  const { format: formatFiat, rateReady } = useFiat()
  const { isBalanceVisible } = useBalanceVisibility()
  const formattedAmount = formatTransactionCardAmount({ amount, kind })

  return (
    <div className={transactionCardStyles({ status })} title={status === 'unknown' ? 'Status unavailable' : undefined}>
      <TransactionCardIcons status={status} />
      <div className={"flex-1 min-w-0 flex flex-col gap-[.25rem]"}>
        <div className={"flex min-w-0 items-center gap-[.3125rem]"} title={title}>
          <Tooltip label={kind === 'platform' ? 'L2 Dash Evo Chain' : kind === 'core' ? 'L1 Dash Core Chain' : undefined}>
            <span className="inline-flex shrink-0" title="">
              <CustomBadge
                text={kind === 'platform' ? 'evo' : kind ?? ''}
                variant={variantAmountSummary}
                size={"s"}
                className={`w-12 shrink-0 ${kind === 'platform' ? 'bg-violet-500/15! text-violet-700! dark:bg-violet-400/20! dark:text-violet-300!' : ''}`}
              />
            </span>
          </Tooltip>
          <Text reset size={12} weight={"medium"} color={"brand"} className={"min-w-0 truncate leading-[120%]"}>
            {title}
          </Text>
        </div>

        <div className={"min-w-0"} title={`${subtitleLabel}: ${labelValue}`}>
          <Text reset size={10} weight={"light"} color={"brand"} opacity={30} className={fullIdentifiers ? "block [overflow-wrap:anywhere]" : "block truncate"}>
            {subtitleLabel}: {labelValue}
          </Text>
        </div>

        <div
          className={`flex min-w-0 gap-[.25rem] ${fullIdentifiers ? 'items-start' : 'items-center'}`}
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
            className={fullIdentifiers ? "min-w-0 whitespace-nowrap font-mono text-[.5625rem]!" : "min-w-0 truncate font-mono"}
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
    </div>
  )
}
