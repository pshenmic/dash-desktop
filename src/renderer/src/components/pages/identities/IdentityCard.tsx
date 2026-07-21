import { Avatar, Identifier } from "dash-ui-kit/react";
import { Identity } from "./Page";
import { Text, ExternalLinkIcon } from "@renderer/components/dash-ui-kit-enxtended";
import AmountSummary from "@renderer/components/ui/AmountSummary";
import CopyButton from "@renderer/components/ui/CopyButton";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import { useAuth } from "@renderer/contexts/AuthContext";
import { transactionUrl, openExternal } from "@renderer/utils/explorer";

export default function IdentityCard({identity}: {identity: Identity}): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null

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
        {identity.assetLockTxid && (
          <div className={"flex items-center gap-[.3125rem]"}>
            <Text size={10} weight={"medium"} color={"default"} opacity={50}>
              Funded by L1 tx: <span className={"font-mono"}>{identity.assetLockTxid.slice(0, 8)}…{identity.assetLockTxid.slice(-8)}</span>
            </Text>
            <CopyButton text={identity.assetLockTxid} />
            {network && (
              <button
                onClick={() => openExternal(transactionUrl(identity.assetLockTxid!, network))}
                title={"Open in explorer"}
                className={"cursor-pointer hover:opacity-60"}
              >
                <ExternalLinkIcon size={10} color={"currentColor"} className={"dash-text-default opacity-70"} />
              </button>
            )}
          </div>
        )}
      </div>
      <AmountSummary total={<CreditsAmount credits={identity.balance.total} compact unit={identity.balance.currency} align={"end"} amountClassName={"text-inherit gap-[.125rem]!"} unitClassName={"font-medium"} />}
        currency={""}
      />
    </div>
  )
}
