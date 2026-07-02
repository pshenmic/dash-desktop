import { Text, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { useShieldedStatus } from '@renderer/hooks/useShielded'
import WarmupPill from '@renderer/components/pages/shielded/WarmupPill'
import ShieldedSpendForm from '@renderer/components/pages/shielded/ShieldedSpendForm'

export default function UnshieldPage(): React.JSX.Element {
  const warmup = useShieldedStatus()

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      <div className={"flex items-end justify-between gap-6 px-12 pt-2"}>
        <div className={"flex flex-col gap-3"}>
          <div className={"flex items-center gap-3"}>
            <ShieldSmallIcon size={28} className={"text-dash-brand dark:text-dash-mint"} />
            <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Unshield</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
            Move credits out of your shielded balance to a transparent Platform address. The amount and destination become public on-chain.
          </Text>
        </div>
        <WarmupPill ready={warmup.ready} />
      </div>
      <ShieldedSpendForm kind={"unshield"} warmupReady={warmup.ready} />
    </div>
  )
}
