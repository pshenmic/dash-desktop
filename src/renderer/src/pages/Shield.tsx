import { Text, ShieldSmallIcon, CheckIcon } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import { useShieldedStatus } from '@renderer/hooks/useShielded'
import ShieldForm from '@renderer/components/pages/shield/ShieldForm'

export default function ShieldPage(): React.JSX.Element {
  const warmup = useShieldedStatus()
  const ready = warmup.ready

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      <div className={"flex items-end justify-between gap-6 px-12 pt-2"}>
        <div className={"flex flex-col gap-3"}>
          <div className={"flex items-center gap-3"}>
            <ShieldSmallIcon size={28} className={"text-dash-brand dark:text-dash-mint"} />
            <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Shield</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
            Move transparent Platform credits into your private shielded balance. The deposit amount is public on-chain; everything you do inside the pool afterwards stays private.
          </Text>
        </div>
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
      </div>
      <ShieldForm warmupReady={ready} />
    </div>
  )
}
