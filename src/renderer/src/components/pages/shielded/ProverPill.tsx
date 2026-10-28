import { Text, CheckIcon, ErrorIcon } from '@renderer/components/dash-ui-kit-extended'
import Spinner from '@renderer/components/ui/Spinner'
import { ShieldedStatus } from '@renderer/api/types'
import { ShieldedProverState } from '@renderer/enums/ShieldedProverState'
import { PROVER_PILL_TEXTS } from '@renderer/constants/shielded'
import { proverFailureLabel } from '@renderer/utils/proverPill'

export default function ProverPill({ status }: { status: ShieldedStatus }): React.JSX.Element {
  if (status.prover === ShieldedProverState.Ready) {
    return (
      <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block shrink-0"}>
        <CheckIcon size={14} color={"currentColor"} className={"shrink-0 text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
        <Text size={12} weight={"medium"} color={"blue-mint"}>{PROVER_PILL_TEXTS.ready}</Text>
      </div>
    )
  }

  if (status.prover === ShieldedProverState.Error) {
    return (
      <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-3 max-w-90 shrink-0"} title={status.error ?? undefined}>
        <ErrorIcon size={14} />
        <Text size={12} weight={"medium"} color={"red"} className={"truncate"}>{proverFailureLabel(status.error)}</Text>
      </div>
    )
  }

  return (
    <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block shrink-0"}>
      <Spinner size={14} />
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{PROVER_PILL_TEXTS.preparing}</Text>
    </div>
  )
}
