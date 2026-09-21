import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import type { TransactionDetailTokenProps } from '@renderer/types/WalletTransaction'

export default function TransactionDetailToken({ icon, label, value, subValue }: TransactionDetailTokenProps): React.JSX.Element {
  return (
    <div className={'flex flex-1 items-center justify-between gap-3 min-h-17 min-w-0 p-3 rounded-xl dash-block'}>
      <div className={'flex items-center gap-[.625rem]'}>
        <span className={'flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12'}>
          {icon}
        </span>
        <Text size={14} weight={'medium'} color={'brand'}>{label}</Text>
      </div>
      <div className={'flex flex-col items-end gap-[.3125rem]'}>
        <div>{value}</div>
        {subValue && <Text size={10} weight={'medium'} color={'brand'} opacity={30}>{subValue}</Text>}
      </div>
    </div>
  )
}
