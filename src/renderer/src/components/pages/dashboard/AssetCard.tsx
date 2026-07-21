import { Text } from '@renderer/components/dash-ui-kit-enxtended'

interface AssetCardProps {
  title: string
  balanceLabel: string
  amount: React.ReactNode
  badge: React.ReactNode | null
  art: string
  variant: 'core' | 'platform'
  loading: boolean
  hidden: boolean
}

export default function AssetCard({
  title,
  balanceLabel,
  amount,
  badge,
  art,
  variant,
  loading,
  hidden
}: AssetCardProps): React.JSX.Element {
  const blur = hidden ? 'blur-sm select-none pointer-events-none' : ''
  const surface =
    variant === 'core'
      ? 'bg-dash-brand'
      : 'bg-dash-primary-dark-blue dark:border dark:border-white/12'
  const badgeSurface = variant === 'core' ? 'bg-dash-primary-dark-blue/50' : 'bg-white/10'

  return (
    <div className={`relative overflow-hidden flex flex-col gap-3 p-5 rounded-3xl ${surface}`}>
      <img
        src={art}
        alt={""}
        aria-hidden
        className={"absolute -top-9 -right-9 w-90 max-w-none opacity-90 pointer-events-none select-none [mask-image:linear-gradient(to_left,black_45%,transparent_95%)]"}
      />

      <div className={"relative flex flex-col gap-2.5"}>
        <Text size={16} weight={"bold"} color={"white"} className={"leading-[120%]"}>
          {title}
        </Text>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"white"} opacity={60} className={"leading-[120%]"}>
            {balanceLabel}
          </Text>
          {loading ? (
            <div className={"h-8 w-40 rounded-lg animate-pulse bg-white/15"} />
          ) : (
            <div className={"flex items-center gap-2.5 flex-wrap"}>
              <Text size={24} weight={"extrabold"} color={"white"} className={`leading-[120%] ${blur}`}>
                {amount}
              </Text>
              {badge != null && (
                <span className={`flex items-center rounded-full px-3 py-1 ${badgeSurface} ${blur}`}>
                  <Text size={12} weight={"medium"} color={"white"} opacity={90} className={"whitespace-nowrap"}>
                    {badge}
                  </Text>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
