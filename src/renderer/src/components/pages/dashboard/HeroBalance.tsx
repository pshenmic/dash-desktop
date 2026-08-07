import { Text, Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import { dashboardPage, SHIELDED_BALANCE_UNKNOWN_TOOLTIP } from '@renderer/constants'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useWalletBalance } from '@renderer/hooks/useWalletBalance'
import { usePlatformCredits } from '@renderer/hooks/usePlatformCredits'
import { useShieldedCredits } from '@renderer/hooks/useShielded'
import { useFiat } from '@renderer/hooks/useFiat'
import { useRates } from '@renderer/hooks/useRates'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { creditsToDuffs, davToDash } from '@renderer/utils/balance'
import { formatFiat as formatFiatValue } from '@renderer/utils/fiat'
import { formatChange24h } from '@renderer/utils/networkStatus'
import coreArt from '@renderer/assets/images/pageAuthorization/auth-bg-flower.png'
import platformArt from '@renderer/assets/images/pageAuthorization/auth-bg-stack.png'
import AssetCard from './AssetCard'

export default function HeroBalance(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined

  const { balance, loading: balanceLoading } = useWalletBalance(walletId)
  const { format: formatFiat, rateReady, currency } = useFiat()
  const { rates, changes24h } = useRates()
  const { isBalanceVisible } = useBalanceVisibility()
  const { totalBalance, price, core, platform } = dashboardPage.hero

  const platformCredits = usePlatformCredits(walletId)
  const shieldedCredits = useShieldedCredits(walletId)
  const platformDuffs = creditsToDuffs(platformCredits)
  const totalReady = shieldedCredits !== null
  const totalDuffs = balance.dash.amount + creditsToDuffs(platformCredits + (shieldedCredits ?? 0n))

  const blur = isBalanceVisible ? '' : 'blur-sm select-none pointer-events-none'
  const priceRate = rates[currency] ?? 0
  const change = changes24h?.[currency]
  const fiatBadge = (duffs: bigint): string | null =>
    rateReady ? `~ ${formatFiat(duffs)} ${currency.toUpperCase()}` : null

  return (
    <section className={"relative overflow-hidden flex flex-col gap-5 p-5 rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
      <div className={"absolute inset-0 pointer-events-none dark:hidden bg-[linear-gradient(to_right,rgba(12,28,51,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(12,28,51,0.03)_1px,transparent_1px)] bg-[size:2.5rem_2.5rem]"} />
      <div className={"absolute inset-0 pointer-events-none hidden dark:block bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:2.5rem_2.5rem]"} />
      <div className={"absolute -top-24 -right-16 size-64 rounded-full bg-dash-brand/10 dark:bg-dash-mint/8 blur-3xl pointer-events-none"} />

      <div className={"relative flex flex-wrap items-start justify-between gap-4"}>
        <div className={"flex flex-col gap-1.5"}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
            {totalBalance}
          </Text>
          {balanceLoading ? (
            <div className={"h-11 w-64 rounded-xl animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8"} />
          ) : (
            <div className={"flex items-center gap-3.5 flex-wrap"}>
              {totalReady ? (
                <Text size={40} weight={"extrabold"} color={"blue-mint"} className={`leading-[110%] ${blur}`}>
                  <DashBigNumber className={"gap-[.1875rem]!"}>{davToDash(totalDuffs)}</DashBigNumber>
                  {' Dash'}
                </Text>
              ) : (
                <Tooltip label={SHIELDED_BALANCE_UNKNOWN_TOOLTIP}>
                  <span className={`text-[2.5rem] font-extrabold leading-[110%] text-dash-orange ${blur}`}>— Dash</span>
                </Tooltip>
              )}
              {totalReady && rateReady && (
                <span className={`flex items-center rounded-full px-3.5 py-1.5 bg-dash-brand/10 dark:bg-dash-mint/10 ${blur}`}>
                  <Text size={14} weight={"medium"} color={"blue-mint"} className={"whitespace-nowrap"}>
                    ~ {formatFiat(totalDuffs)} {currency.toUpperCase()}
                  </Text>
                </span>
              )}
            </div>
          )}
        </div>

        {rateReady && (
          <div className={"flex items-baseline gap-1.5"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
              {price}
            </Text>
            <Text size={12} weight={"bold"} color={"brand"}>
              {formatFiatValue(priceRate, currency)}
            </Text>
            {change !== undefined && (
              <Text size={12} weight={"bold"} className={change < 0 ? 'text-dash-red' : 'text-dash-green'}>
                {formatChange24h(change)}
              </Text>
            )}
          </div>
        )}
      </div>

      <div className={"relative grid grid-cols-1 lg:grid-cols-2 gap-4"}>
        <AssetCard
          title={core.title}
          balanceLabel={core.balance}
          amount={
            <>
              <DashBigNumber className={"gap-[.1875rem]!"}>{davToDash(balance.dash.amount)}</DashBigNumber>
              {' Dash'}
            </>
          }
          badge={fiatBadge(balance.dash.amount)}
          art={coreArt}
          variant={"core"}
          loading={balanceLoading}
          hidden={!isBalanceVisible}
        />
        <AssetCard
          title={platform.title}
          balanceLabel={platform.balance}
          amount={
            <CreditsAmount
              credits={platformCredits}
              showFiat={false}
              unitClassName={"text-[.875rem] font-medium text-white/60"}
            />
          }
          badge={fiatBadge(platformDuffs)}
          art={platformArt}
          variant={"platform"}
          loading={balanceLoading}
          hidden={!isBalanceVisible}
        />
      </div>
    </section>
  )
}
