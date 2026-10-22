import { Avatar } from "dash-ui-kit/react";
import { Identity } from "./Page";
import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import AddressRow from "@renderer/components/ui/AddressRow";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useBalanceVisibility } from "@renderer/hooks/useBalanceVisibility";
import { identityUrl } from "@renderer/utils/explorer";
import { creditsToDuffs } from "@renderer/utils/balance";

export default function IdentityCard({identity}: {identity: Identity}): React.JSX.Element {
  const { status } = useAuth()
  const { isBalanceVisible } = useBalanceVisibility()
  const network = status?.network ?? null

  return (
    <AddressRow
      address={identity.walletAddress}
      leading={
        <div className={"flex items-center justify-center size-8.5 rounded-full dash-subtle shrink-0"}>
          <Avatar sizes={"14"} username={identity.walletAddress}/>
        </div>
      }
      meta={identity.name && <Text size={10} weight={"medium"} color={"brand"} opacity={50}>Username: <span className={"font-bold"}>{identity.name}</span></Text>}
      amount={<CreditsAmount credits={identity.balance.total} compact unit={identity.balance.currency} showFiat={false} align={"end"} amountClassName={"font-bold"} />}
      fiatDuffs={creditsToDuffs(identity.balance.total)}
      explorerUrl={network ? identityUrl(identity.walletAddress, network) : undefined}
      hidden={!isBalanceVisible}
    />
  )
}
