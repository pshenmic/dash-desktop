import { Text, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { useShieldedStatus } from '@renderer/hooks/useShielded'
import WarmupPill from '@renderer/components/pages/shielded/WarmupPill'
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
        <WarmupPill status={warmup} />
      </div>
      <ShieldForm warmupReady={ready} />
    </div>
  )
}
