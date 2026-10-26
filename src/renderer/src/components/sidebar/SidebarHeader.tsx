import { DashLogo } from "dash-ui-kit/react"
import Balance from "./Balance";
import { ChevronIcon, EyeClosedIcon, EyeOpenIcon, InfoCircleIcon, LockIcon, Tooltip } from "../dash-ui-kit-enxtended";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useBalanceBreakdown } from "@renderer/hooks/useBalanceBreakdown";
import { useFiat } from "@renderer/hooks/useFiat";
import { useWalletBalance } from "@renderer/hooks/useWalletBalance";
import { usePlatformAddresses } from "@renderer/hooks/usePlatformAddresses";
import { useIdentities } from "@renderer/hooks/useIdentities";
import { totalIdentityCredits, totalPlatformAddressCredits, totalWalletCredits } from "@renderer/utils/platformBalances";
import {
  SIDEBAR_BALANCE_BREAKDOWN,
  SIDEBAR_BALANCE_BREAKDOWN_CLOSED,
  SIDEBAR_BALANCE_BREAKDOWN_ID,
  SIDEBAR_BALANCE_BREAKDOWN_OPEN,
  SIDEBAR_BALANCE_CHEVRON,
  SIDEBAR_BALANCE_COPY,
  SIDEBAR_BALANCE_ROWS,
  SIDEBAR_BALANCE_TOGGLE,
} from "@renderer/constants/balance";
import { useBalanceVisibility } from "@renderer/hooks/useBalanceVisibility";
import { useShieldedSyncState } from "@renderer/hooks/useShielded";
import { ShieldedSyncPhase } from "@renderer/enums/ShieldedSyncPhase";

export default function SidebarHeader(): React.JSX.Element {
  const { status, lock } = useAuth()
  const { balance } = useWalletBalance(status?.selectedWalletId ?? undefined)
  const { platformAddresses } = usePlatformAddresses(status?.selectedWalletId ?? undefined)
  const { identities } = useIdentities(status?.selectedWalletId ?? undefined)
  const { isBalanceVisible, toggleBalanceVisibility } = useBalanceVisibility()
  const { format: formatFiat, rateReady } = useFiat()
  const shieldedSync = useShieldedSyncState(status?.selectedWalletId ?? null)
  const shieldedCredits = shieldedSync.phase === ShieldedSyncPhase.Done && shieldedSync.balance !== null
    ? shieldedSync.balance
    : undefined
  const platformCredits = totalPlatformAddressCredits(platformAddresses)
  const identityCredits = totalIdentityCredits(identities)
  const { isBreakdownOpen, toggleBreakdown } = useBalanceBreakdown()

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
            aria-label={isBalanceVisible ? 'Hide balances' : 'Show balances'}
            title={isBalanceVisible ? 'Hide balances' : 'Show balances'}
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
      <div className={"flex flex-col dash-block rounded-[.875rem] dash-black-border"}>
        <button
          type={"button"}
          onClick={toggleBreakdown}
          aria-expanded={isBreakdownOpen}
          aria-controls={SIDEBAR_BALANCE_BREAKDOWN_ID}
          className={SIDEBAR_BALANCE_TOGGLE}
        >
          <div className={"min-w-0 flex-1"}>
            <Balance
              variant="total"
              credits={totalWalletCredits(balance.dash.amount, [platformCredits, identityCredits, shieldedCredits])}
              isVisible={isBalanceVisible}
            />
          </div>
          {shieldedCredits === undefined && (
            <Tooltip label={SIDEBAR_BALANCE_COPY.excludesShielded}>
              <span className={"flex text-dash-orange"}><InfoCircleIcon size={14} color={"currentColor"} /></span>
            </Tooltip>
          )}
          <ChevronIcon size={12} color={"currentColor"} className={`${SIDEBAR_BALANCE_CHEVRON} ${isBreakdownOpen ? 'rotate-180' : ''}`} />
        </button>
        <div
          id={SIDEBAR_BALANCE_BREAKDOWN_ID}
          inert={!isBreakdownOpen}
          className={`${SIDEBAR_BALANCE_BREAKDOWN} ${isBreakdownOpen ? SIDEBAR_BALANCE_BREAKDOWN_OPEN : SIDEBAR_BALANCE_BREAKDOWN_CLOSED}`}
        >
          <div className={"min-h-0 overflow-hidden"}>
            <div className={SIDEBAR_BALANCE_ROWS}>
              <Balance variant="dash" balance={balance.dash.amount} isVisible={isBalanceVisible} fiat={rateReady ? formatFiat(balance.dash.amount) : undefined}/>
              <Balance variant="credits" credits={platformCredits} isVisible={isBalanceVisible}/>
              <Balance variant="identities" credits={identityCredits} isVisible={isBalanceVisible}/>
              <Balance variant="shielded" credits={shieldedCredits} isVisible={isBalanceVisible}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
