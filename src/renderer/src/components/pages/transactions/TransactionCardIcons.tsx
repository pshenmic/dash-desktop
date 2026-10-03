import { TRANSACTION_CARD_STATUS_ICONS } from '@renderer/constants/transactionsPage'
import type { TransactionCardItem } from '@renderer/types/WalletTransaction'
import { cva } from "class-variance-authority";

const transactionCardIconsStyles = cva(
  `
    shrink-0
  `,
  {
    variants: {
      status: {
        failed: 'rounded-full text-dash-red [&_rect]:[fill-opacity:0.12]',
        success: 'dash-text-primary [&_circle]:fill-current [&_circle]:[fill-opacity:0.12] dark:[&_circle]:[fill-opacity:0.04]',
        pending: 'dash-text-default [&_circle]:fill-current [&_circle]:[fill-opacity:0.05] dark:[&_circle]:[fill-opacity:0.04]',
        unknown: 'dash-text-default opacity-50',
      },
    },
  },
)

export default function TransactionCardIcons({ status }: Pick<TransactionCardItem, 'status'>): React.JSX.Element {
  const iconProps = { size: 18, color: 'currentColor' as const, className: transactionCardIconsStyles({ status }) };
  const Icon = TRANSACTION_CARD_STATUS_ICONS[status]

  return <Icon {...iconProps} />
}
