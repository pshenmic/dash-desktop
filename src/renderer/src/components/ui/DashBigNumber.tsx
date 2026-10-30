import { BigNumber, type BigNumberProps } from 'dash-ui-kit/react'
import { DASH_BIG_NUMBER_CLASS } from '@renderer/constants/balance'

export default function DashBigNumber({ className, ...props }: BigNumberProps): React.JSX.Element {
  return <BigNumber className={className != null ? `${DASH_BIG_NUMBER_CLASS} ${className}` : DASH_BIG_NUMBER_CLASS} {...props} />
}
