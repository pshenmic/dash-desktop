import { useNavigate } from 'react-router-dom'
import { BigNumber } from 'dash-ui-kit/react'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ReceiveIcon, SendIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { dashboardPage } from '@renderer/constants'
import { davToDash, davToDashCompact } from '@renderer/utils/balance'
import { useFiat } from '@renderer/hooks/useFiat'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'

interface HeroBalanceProps {
  balanceDuffs: bigint
  netFlow30d: bigint
  hasActivity: boolean
  loading: boolean
}

export default function HeroBalance({ balanceDuffs, netFlow30d, hasActivity, loading }: HeroBalanceProps): React.JSX.Element {
  const navigate = useNavigate()
  const { format: formatFiat, rateReady } = useFiat()
  const { isBalanceVisible } = useBalanceVisibility()
  const { label, send, receive, netFlowSuffix } = dashboardPage.balance

  const blur = isBalanceVisible ? '' : 'blur-sm select-none pointer-events-none'
  const netPositive = netFlow30d > 0n
  const netAbs = netPositive ? netFlow30d : -netFlow30d

  return (
    <div className={"relative overflow-hidden flex flex-wrap items-center justify-between gap-6 p-6 rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
      <div className={"absolute -top-24 -right-16 size-64 rounded-full bg-dash-brand/10 dark:bg-dash-mint/8 blur-3xl pointer-events-none"} />

      <div className={"flex flex-col gap-1.5"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
          {label}
        </Text>
        {loading ? (
          <div className={"h-10 w-52 rounded-xl animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8"} />
        ) : (
          <Text size={36} weight={"extrabold"} color={"brand"} className={`leading-[110%] ${blur}`}>
            <BigNumber className={"gap-[.1875rem]!"}>{davToDash(balanceDuffs)}</BigNumber>
            {' Dash'}
          </Text>
        )}
        {!loading && rateReady && (
          <Text size={14} weight={"medium"} color={"blue-mint"} className={`leading-[120%] ${blur}`}>
            ~ {formatFiat(balanceDuffs)}
          </Text>
        )}
        {!loading && hasActivity && netFlow30d !== 0n && (
          <div className={"flex mt-1.5"}>
            <span className={"flex items-center rounded-full dash-block px-3 py-1.5"}>
              <Text
                size={12}
                weight={"medium"}
                color={netPositive ? 'blue-mint' : 'brand'}
                className={blur}
              >
                {netPositive ? '+' : '-'}{davToDashCompact(netAbs)} Dash {netFlowSuffix}
              </Text>
            </span>
          </div>
        )}
      </div>

      <div className={"relative flex items-center gap-3"}>
        <Button colorScheme={"primary"} size={"sm"} onClick={() => navigate('/send')}>
          <span className={"flex items-center gap-2"}>
            <SendIcon size={11} color={"currentColor"} />
            {send}
          </span>
        </Button>
        <Button colorScheme={"lightBlue-mint"} size={"sm"} onClick={() => navigate('/receive')}>
          <span className={"flex items-center gap-2"}>
            <ReceiveIcon size={11} color={"currentColor"} />
            {receive}
          </span>
        </Button>
      </div>
    </div>
  )
}
