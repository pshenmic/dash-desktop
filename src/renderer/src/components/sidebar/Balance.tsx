import { BigNumber, DashLogo, useTheme } from "dash-ui-kit/react";
import { CreditsIcon, ShieldSmallIcon, Text } from "../dash-ui-kit-enxtended";
import CreditsAmount from "../ui/CreditsAmount";
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
        dash: 'bg-dash-brand dark:bg-[var(--color-dash-blue-20)]',
        credits: 'bg-dash-primary-dark-blue/5 dark:bg-[var(--color-dash-blue-20)]',
        shielded: 'bg-dash-primary-dark-blue/5 dark:bg-[var(--color-dash-blue-20)]'
      }
    }
  }
)

export default function Balance({variant, balance, credits, isVisible, fiat}: {variant: 'dash' | 'credits' | 'shielded', balance?: string, credits?: bigint, isVisible: boolean, fiat?: string}): React.JSX.Element {
  const { theme } = useTheme()

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
        {variant === 'dash' ?
          <DashLogo width={20} height={20} containerSize={39} color={theme === 'light' ? 'white' : 'var(--color-dash-brand)'}/>
        : variant === 'shielded' ?
          <ShieldSmallIcon size={15} color={"#4C7EFF"}/>
        :
          <CreditsIcon size={15}/>
        }
      </div>
      <div className={"flex flex-col gap-[.125rem]"}>
        <Text size={12} weight="medium" color="brand" className={"leading-[120%]"} opacity={50}>{variant === 'dash' ? 'Core Balance:' : variant === 'shielded' ? 'Shielded:' : 'Platform Credits:'}</Text>
        <Text size={16} weight="extrabold" color="brand" className={`${!isVisible ? 'blur-sm select-none pointer-events-none' : ''} leading-[120%]`}>
          {(variant === 'credits' || variant === 'shielded') && credits != null ? (
            <CreditsAmount credits={credits} compact unit={"Credits"} amountClassName={"gap-[.125rem]!"} />
          ) : (
            <>
              <BigNumber className={"gap-[.125rem]!"}>{balance ?? ''}</BigNumber>
              {variant === 'dash' ? ' Dash' : ' Credits'}
            </>
          )}
        </Text>
        { fiat &&
          <Text size={10} weight="medium" color="blue-mint" className={`${!isVisible ? 'blur-sm select-none pointer-events-none' : ''} leading-[120%]`}>~ {fiat}</Text>
        }
      </div>
    </div>
  )
}
