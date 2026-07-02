import { useAuth } from '@renderer/contexts/AuthContext'
import { Text, ShieldSmallIcon, CheckIcon, ErrorIcon } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import { useShieldedPoolInfo, useShieldedStatus } from '@renderer/hooks/useShielded'
import { davToDashCompact } from '@renderer/utils/balance'
import { ShieldedStatus } from '@renderer/api/types'

function WarmupBadge({ status }: { status: ShieldedStatus }): React.JSX.Element {
  if (status.warmup === 'ready') {
    return (
      <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-accent-5"}>
        <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />
        <Text size={12} weight={"medium"} color={"blue-mint"}>Ready</Text>
      </div>
    )
  }

  if (status.warmup === 'error') {
    return (
      <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-3"}>
        <ErrorIcon size={14} />
        <Text size={12} weight={"medium"} color={"red"}>Preparation failed</Text>
      </div>
    )
  }

  return (
    <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block"}>
      <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Preparing private transactions…</Text>
    </div>
  )
}

export default function ShieldedPage(): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const warmup = useShieldedStatus()
  const { poolInfo } = useShieldedPoolInfo(network ?? undefined)

  const poolStateDash = poolInfo.poolState !== null ? davToDashCompact(BigInt(poolInfo.poolState)) : null
  const notesCount = poolInfo.notesCount !== null ? BigInt(poolInfo.notesCount).toLocaleString('en-US') : null

  return (
    <div className={"flex flex-col gap-8 px-12 py-10"}>
      <div className={"flex items-end justify-between gap-6"}>
        <div className={"flex flex-col gap-3"}>
          <div className={"flex items-center gap-3"}>
            <ShieldSmallIcon size={28} className={"text-dash-brand dark:text-dash-mint"} />
            <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Shielded</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
            Private Orchard transactions. Move funds between your transparent and shielded balance, where the link between sender and recipient stays hidden.
          </Text>
        </div>
        <WarmupBadge status={warmup} />
      </div>

      <div className={"flex flex-col gap-4 w-full max-w-160"}>
        <div className={"flex flex-col gap-2 p-5 rounded-[.9375rem] dash-block-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Your shielded balance</Text>
          <div className={"flex items-baseline gap-2"}>
            <Text size={32} weight={"bold"} color={"brand"}>—</Text>
            <Text size={16} weight={"medium"} color={"brand"} opacity={50}>DASH</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Note recovery from your viewing key is coming next. Your deposits, private sends and withdrawals will appear here.
          </Text>
        </div>

        <div className={"flex flex-col gap-3 p-5 rounded-[.9375rem] dash-block"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Shielded pool ({network ?? 'unknown'})</Text>
          <div className={"flex items-center justify-between"}>
            <Text size={14} weight={"medium"} color={"brand"} opacity={70}>Total in pool</Text>
            <Text size={14} weight={"bold"} color={"brand"}>{poolStateDash !== null ? `${poolStateDash} DASH` : '—'}</Text>
          </div>
          <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
          <div className={"flex items-center justify-between"}>
            <Text size={14} weight={"medium"} color={"brand"} opacity={70}>Notes in tree</Text>
            <Text size={14} weight={"bold"} color={"brand"}>{notesCount !== null ? notesCount : '—'}</Text>
          </div>
        </div>
      </div>
    </div>
  )
}
