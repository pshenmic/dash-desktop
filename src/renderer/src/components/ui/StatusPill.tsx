import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import { STATUS_PILL_BASE, STATUS_PILL_TONES } from '@renderer/constants/statusPill'
import type { StatusPillProps } from '@renderer/types/StatusPill'

export default function StatusPill({ tone, children, loading = false }: StatusPillProps): React.JSX.Element {
  return (
    <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_TONES[tone]}`}>
      {loading && <Spinner size={10} className={'shrink-0 text-current'} />}
      <Text reset size={12} weight={'medium'} className={'whitespace-nowrap text-inherit!'}>{children}</Text>
    </span>
  )
}
