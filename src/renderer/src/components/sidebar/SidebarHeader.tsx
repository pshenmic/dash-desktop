import { DashLogo } from "dash-ui-kit/react"
import Balance from "./Balance";
import { EyeClosedIcon, EyeOpenIcon, LockIcon } from "../dash-ui-kit-enxtended";
import { useAuth } from "@renderer/contexts/AuthContext";
import { davToDashCompact } from "@renderer/utils/balance";
import { useFiat } from "@renderer/hooks/useFiat";
import { useWalletBalance } from "@renderer/hooks/useWalletBalance";
import { useBalanceVisibility } from "@renderer/hooks/useBalanceVisibility";
import { useShieldedSyncState } from "@renderer/hooks/useShielded";

export default function SidebarHeader(): React.JSX.Element {
  const { status, lock } = useAuth()
  const { balance } = useWalletBalance(status?.selectedWalletId ?? undefined)
  const { isBalanceVisible, toggleBalanceVisibility } = useBalanceVisibility()
  const { format: formatFiat, rateReady } = useFiat()
  const shieldedSync = useShieldedSyncState(status?.selectedWalletId ?? null)
  const shieldedCredits = shieldedSync.phase === 'done' && shieldedSync.balance !== null
    ? BigInt(shieldedSync.balance)
    : 0n

  return (
    <div className={"flex flex-col gap-8 justify-between w-full"}>
      <div className={"flex items-center justify-between w-full pl-3.75 relative [&>div.relative]:!static"}>
        <DashLogo width={30} height={35} containerSize={48}/>
        <div className={"flex items-center gap-2"}>
          <button
            onClick={lock}
            className={`
              size-6
              dash-block
              rounded-[.25rem]
              p-[.25rem]
              flex
              items-center
              justify-center
              cursor-pointer
              hover:opacity-80
              transition-opacity
              duration-200
            `}
          >
            <LockIcon size={12} color={"currentColor"} className={"dash-text-default"} />
          </button>
          <button
            onClick={toggleBalanceVisibility}
            className={`
              size-6
              dash-block
              rounded-[.25rem]
              p-[.25rem]
              flex
              items-center
              justify-center
              cursor-pointer
              hover:opacity-80
              transition-opacity
              duration-200
            `}
          >
            {isBalanceVisible ? (
              <EyeOpenIcon size={16} className={"dash-text-default"} />
            ) : (
              <EyeClosedIcon size={16} className={"dash-text-default"} />
            )}
          </button>
        </div>
      </div>
      <div className={"flex flex-col dash-block rounded-[.875rem] dash-black-border divide-y divide-dash-primary-dark-blue/8 dark:divide-white/12"}>
        <Balance variant="dash" balance={davToDashCompact(balance.dash.amount)} isVisible={isBalanceVisible} fiat={rateReady ? formatFiat(balance.dash.amount) : undefined}/>
        <Balance variant="credits" credits={balance.credits.amount} isVisible={isBalanceVisible}/>
        <Balance variant="shielded" credits={shieldedCredits} isVisible={isBalanceVisible}/>
      </div>
    </div>
  )
}
