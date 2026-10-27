import { InfoTooltip, Text } from '@renderer/components/dash-ui-kit-extended'
import { SURFACE_ROW } from '@renderer/constants/surfaces'
import type { TransactionDetailTokenProps } from '@renderer/types/TransactionDetailToken'

export default function TransactionDetailToken({ icon, label, hint, value, subValue }: TransactionDetailTokenProps): React.JSX.Element {
  return (
    <div className={`flex flex-1 items-center justify-between gap-3 min-h-17 min-w-0 ${SURFACE_ROW}`}>
      <div className={'flex items-center gap-[.625rem]'}>
        <span className={'flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12'}>
          {icon}
        </span>
        <Text size={14} weight={'medium'} color={'brand'}>{label}</Text>
        {hint && <InfoTooltip content={hint} />}
      </div>
      <div className={'flex flex-col items-end gap-[.3125rem]'}>
        <div>{value}</div>
        {subValue && <Text size={10} weight={'medium'} color={'brand'} opacity={30}>{subValue}</Text>}
      </div>
    </div>
  )
}
