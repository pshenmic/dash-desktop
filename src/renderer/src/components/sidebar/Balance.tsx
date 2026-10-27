import { DashLogo, useTheme } from "dash-ui-kit/react";
import { CreditsIcon, IdenticonIcon, ShieldSmallIcon, Text, Tooltip } from "../dash-ui-kit-extended";
import CreditsAmount from "../ui/CreditsAmount";
import DashBigNumber from "../ui/DashBigNumber";
import SensitiveValue from "../ui/SensitiveValue";
import { creditsToDuffs, davToDash } from "@renderer/utils/balance";
import { formatApproxFiat } from "@renderer/utils/approxFiat";
import { useFiat } from "@renderer/hooks/useFiat";
import { SHIELDED_BALANCE_UNKNOWN_TOOLTIP } from "@renderer/constants";
import { DASH_UNIT, SIDEBAR_BALANCE_LABELS, UNKNOWN_BALANCE_LABEL } from "@renderer/constants/balance";
import type { SidebarBalanceProps } from "@renderer/types/SidebarBalance";
import { cva } from "class-variance-authority";

const logoStyles = cva(
  `
    size-[2.4375rem]
    rounded-full
    flex
    items-center
    justify-center
    shrink-0
  `,
  {
    variants: {
      variant: {
        total: 'bg-dash-brand dark:bg-[var(--color-dash-blue-20)]',
        dash: 'bg-dash-brand dark:bg-[var(--color-dash-blue-20)]',
        credits: 'bg-dash-primary-dark-blue/5 dark:bg-[var(--color-dash-blue-20)]',
        identities: 'bg-dash-primary-dark-blue/5 dark:bg-[var(--color-dash-blue-20)]',
        shielded: 'bg-dash-primary-dark-blue/5 dark:bg-[var(--color-dash-blue-20)]'
      }
    }
  }
)

export default function Balance({variant, balance, credits, isVisible, fiat}: SidebarBalanceProps): React.JSX.Element {
  const { theme } = useTheme()
  const { format: formatFiat, rateReady, currency } = useFiat()
  const amountKnown = variant === 'dash' || credits != null
  const creditsFiat = credits != null && rateReady ? formatFiat(creditsToDuffs(credits)) : undefined
  const rowFiat = variant === 'dash' ? fiat : creditsFiat

  return (
    <div
      className={`
        flex
        items-center
        gap-[.9375rem]
        px-[.9375rem]
        py-[.625rem]
      `}
    >
      <div
        className={logoStyles({ variant: variant })}
      >
        {variant === 'dash' || variant === 'total' ?
          <DashLogo width={20} height={20} containerSize={39} color={theme === 'light' ? 'white' : 'var(--color-dash-brand)'}/>
        : variant === 'shielded' ?
          <ShieldSmallIcon size={15} color={"#4C7EFF"}/>
        : variant === 'identities' ?
          <IdenticonIcon size={15}/>
        :
          <CreditsIcon size={15}/>
        }
      </div>
      <div className={"flex flex-col gap-[.125rem]"}>
        <Text size={12} weight="medium" color="brand" className={"leading-[120%]"} opacity={50}>{SIDEBAR_BALANCE_LABELS[variant]}</Text>
        <Text size={16} weight="extrabold" color="brand" className={"leading-[120%]"}>
          {variant === 'shielded' && credits == null ? (
            <Tooltip label={SHIELDED_BALANCE_UNKNOWN_TOOLTIP}>
              <span className={"text-dash-orange"}>{UNKNOWN_BALANCE_LABEL}</span>
            </Tooltip>
          ) : (
            <SensitiveValue hidden={!isVisible} size={"sidebar"} tone={"accent"}>
              {variant !== 'dash' && credits != null ? (
                <CreditsAmount credits={credits} compact unit={"Credits"} showFiat={false} unitClassName={""} />
              ) : (
                <>
                  <DashBigNumber>{davToDash(balance ?? 0n)}</DashBigNumber>
                  {variant === 'dash' ? ` ${DASH_UNIT}` : ' Credits'}
                </>
              )}
            </SensitiveValue>
          )}
        </Text>
        {amountKnown && rowFiat !== undefined &&
          <Text size={10} weight="medium" color="blue-mint" className={"leading-[120%]"}>
            <SensitiveValue hidden={!isVisible} size={"subtext"} tone={"accent"} label={"Fiat balance hidden"}>
              {formatApproxFiat(rowFiat, currency)}
            </SensitiveValue>
          </Text>
        }
      </div>
    </div>
  )
}
