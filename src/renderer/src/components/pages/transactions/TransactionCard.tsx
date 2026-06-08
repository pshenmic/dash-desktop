import AmountSummary from "@renderer/components/ui/AmountSummary"
import TransactionCardIcons from "./TransactionCardIcons"
import CustomBadge from "@renderer/components/ui/CustomBadge"
import { formatCreationDate, timePart } from "@renderer/utils/date"
import { BigNumber, TimeDelta } from "dash-ui-kit/react"
import { cva } from "class-variance-authority"
import { Text, ExternalLinkIcon } from "@renderer/components/dash-ui-kit-enxtended"
import { WalletTxItem } from "@renderer/hooks/useWalletTransactions"
import { davToDash } from "@renderer/utils/balance"
import { useFiat } from "@renderer/hooks/useFiat"

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
      },
    },
  },
)

type TransactionCardProps = WalletTxItem & {
  onOpenExplorer?: () => void
}

export default function TransactionCard({
  status,
  kind,
  title,
  subtitleLabel,
  labelValue,
  amount,
  date,
  direction,
  onOpenExplorer
} : TransactionCardProps): React.JSX.Element {
  const variantAmountSummary = status === 'failed' ? 'error' : kind === 'core' ? 'default' : 'muted'
  const isIncoming = direction === 'in'
  const { format: formatFiat, rateReady } = useFiat()

  return (
    <div className={transactionCardStyles({ status })} >
      <TransactionCardIcons status={status} />
      <div className={"flex-1 flex flex-col gap-[.25rem]"}>
        <div className={"flex items-center gap-[.3125rem]"}>
          <CustomBadge text={kind ?? ''} variant={variantAmountSummary} size={"s"} />
          <Text size={12} weight={"medium"} color={"brand"} className={"leading-[120%]"}>
            {title}
          </Text>
        </div>

        <Text size={10} weight={"light"} color={"brand"} opacity={30}>
          {subtitleLabel}: {labelValue}
        </Text>
      </div>

      <AmountSummary
        total={
          <span className={isIncoming ? 'text-dash-brand dark:text-dash-mint' : ""}>
            {isIncoming ? '+' : '-'}<BigNumber className={"text-inherit"}>{davToDash(amount).toString()}</BigNumber>
          </span>
        }
        textBadge={rateReady ? `~ ${formatFiat(amount)}` : ''}
        variant={variantAmountSummary}
        date={
          <>
            {formatCreationDate(new Date(date))} {timePart(new Date(date))} (<TimeDelta endDate={new Date(date)}/>)
          </>
        }
      />

      {onOpenExplorer && (
        <div
          className={`
            shrink-0 overflow-hidden
            w-0 group-hover:w-7
            opacity-0 group-hover:opacity-100
            transition-all duration-200 ease-out
          `}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onOpenExplorer() }}
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
