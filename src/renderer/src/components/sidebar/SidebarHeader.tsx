import { DashLogo } from "dash-ui-kit/react"
import Balance from "./Balance";
import { EyeClosedIcon, EyeOpenIcon } from "../dash-ui-kit-enxtended";
import { useAuth } from "@renderer/contexts/AuthContext";
import { davToDash } from "@renderer/utils/balance";
import { useFiat } from "@renderer/hooks/useFiat";
import { useWalletBalance } from "@renderer/hooks/useWalletBalance";
import { useBalanceVisibility } from "@renderer/hooks/useBalanceVisibility";

export default function SidebarHeader(): React.JSX.Element {
  const { status } = useAuth()
  const { balance } = useWalletBalance(status?.selectedWalletId ?? undefined)
  const { isBalanceVisible, toggleBalanceVisibility } = useBalanceVisibility()
  const { format: formatFiat, rateReady } = useFiat()

  return (
    <div className={"flex flex-col gap-8 justify-between w-full"}>
      <div className={"flex items-center justify-between w-full pl-3.75 relative [&>div.relative]:!static"}>
        <DashLogo width={30} height={35} containerSize={48}/>
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
      <div className={"flex flex-col gap-[.75rem]"}>
        <Balance variant="dash" balance={davToDash(balance.dash.amount)} isVisible={isBalanceVisible} fiat={rateReady ? formatFiat(balance.dash.amount) : undefined}/>
        <Balance variant="credits" credits={balance.credits.amount} isVisible={isBalanceVisible}/>
      </div>
    </div>
  )
}
