import { Text, CheckIcon } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'

export default function WarmupPill({ ready }: { ready: boolean }): React.JSX.Element {
  return (
    <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block shrink-0"}>
      {ready ? (
        <>
          <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />
          <Text size={12} weight={"medium"} color={"blue-mint"}>Private tx ready</Text>
        </>
      ) : (
        <>
          <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Preparing private transactions…</Text>
        </>
      )}
    </div>
  )
}
