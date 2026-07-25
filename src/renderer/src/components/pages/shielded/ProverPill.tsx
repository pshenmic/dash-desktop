import { Text, CheckIcon, ErrorIcon } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import { ShieldedStatus } from '@renderer/api/types'
import { ShieldedProverState } from '@renderer/enums/ShieldedProverState'

export default function ProverPill({ status }: { status: ShieldedStatus }): React.JSX.Element {
  if (status.prover === ShieldedProverState.Ready) {
    return (
      <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block shrink-0"}>
        <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />
        <Text size={12} weight={"medium"} color={"blue-mint"}>Private tx ready</Text>
      </div>
    )
  }

  if (status.prover === ShieldedProverState.Error) {
    const short = status.error != null && status.error.length > 48 ? `${status.error.slice(0, 48)}…` : status.error
    return (
      <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-3 max-w-90 shrink-0"} title={status.error ?? undefined}>
        <ErrorIcon size={14} />
        <Text size={12} weight={"medium"} color={"red"} className={"truncate"}>Prep failed: {short ?? 'unknown error'}</Text>
      </div>
    )
  }

  return (
    <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block shrink-0"}>
      <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Preparing private transactions…</Text>
    </div>
  )
}
