import { CheckIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import type { PhaseProgressListProps } from '@renderer/types/PhaseProgressList'

export default function PhaseProgressList({ phases, current, className = '' }: PhaseProgressListProps): React.JSX.Element {
  return (
    <ol className={`${SURFACE_SECTION} flex flex-col gap-4 ${className}`}>
      {phases.map((phase, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={phase.key} className={"flex flex-col gap-1.5"} aria-current={active ? 'step' : undefined}>
            <div className={"flex items-center gap-2"}>
              {done && <CheckIcon size={14} color={"currentColor"} className={"shrink-0 text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />}
              {active && <Spinner size={14} className={"shrink-0"} />}
              {!done && !active && <div className={"size-3.5 shrink-0 rounded-full border border-dash-primary-dark-blue/15 dark:border-white/15"} />}
              <Text size={14} weight={"medium"} color={"brand"} opacity={done || active ? 100 : 50}>{phase.label}</Text>
            </div>
            {phase.extra && <div className={"ml-6"}>{phase.extra}</div>}
          </li>
        )
      })}
    </ol>
  )
}
