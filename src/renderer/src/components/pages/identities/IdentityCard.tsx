import { Avatar, BigNumber, Identifier } from "dash-ui-kit/react";
import { Identity } from "./Page";
import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import AmountSummary from "@renderer/components/ui/AmountSummary";
import CopyButton from "@renderer/components/ui/CopyButton";
import { formatCompactCredits } from "@renderer/utils/balance";

export default function IdentityCard({identity}: {identity: Identity}): React.JSX.Element {
  return (
    <div className={"flex items-center w-full dash-block rounded-[.875rem] px-[.9375rem] py-[.625rem]"}>
      <div className={"flex items-center justify-center size-8.5 rounded-full dash-subtle shrink-0"}>
        <Avatar sizes={"14"} username={identity.walletAddress}/>
      </div>
      <div className={"flex flex-col ml-[.5rem]"}>
        <div className={"flex items-center gap-[.3125rem]"}>
          <Identifier highlight={"default"} className={"font-mono text-[.75rem]!"}>
            {identity.walletAddress}
          </Identifier>
          <CopyButton text={identity.walletAddress} />
        </div>
        {identity.name && <Text size={10} weight={"medium"} color={"default"} opacity={50}>Username: <span className={"font-bold"}>{identity.name}</span></Text>}
      </div>
      <AmountSummary total={<BigNumber className={"text-inherit gap-[.125rem]!"}>{formatCompactCredits(identity.balance.total).toString()}</BigNumber>}
        textBadge={`~ $${identity.balance.approx}`}
        currency={identity.balance.currency}
      />
    </div>
  )
}
