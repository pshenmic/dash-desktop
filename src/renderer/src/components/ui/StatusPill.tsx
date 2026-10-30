import { Text } from '@renderer/components/dash-ui-kit-extended'
import { STATUS_PILL_TONES } from '@renderer/constants/statusPill'
import type { StatusPillProps } from '@renderer/types/StatusPill'

export default function StatusPill({ tone, children }: StatusPillProps): React.JSX.Element {
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 ${STATUS_PILL_TONES[tone]}`}>
      <Text reset size={12} weight={'medium'} className={'whitespace-nowrap text-inherit!'}>{children}</Text>
    </span>
  )
}
