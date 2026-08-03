import { BigNumber, type BigNumberProps } from 'dash-ui-kit/react'

const INHERIT_COLOR_CLASS = 'text-inherit!'

export default function DashBigNumber({ className, ...props }: BigNumberProps): React.JSX.Element {
  return <BigNumber className={className != null ? `${INHERIT_COLOR_CLASS} ${className}` : INHERIT_COLOR_CLASS} {...props} />
}
