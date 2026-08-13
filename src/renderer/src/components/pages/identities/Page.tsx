import { Tabs } from "dash-ui-kit/react";
import { useIdentities } from "@renderer/hooks/useIdentities";
import { useAuth } from "@renderer/contexts/AuthContext";
import IdentityCard from "./IdentityCard";
import NoResults from "@renderer/components/ui/NoResults";
import ListSkeleton from "@renderer/components/ui/Skeleton";
import { Button, Text } from "@renderer/components/dash-ui-kit-enxtended";
import { useNavigate } from "react-router-dom";

export interface Identity {
  walletAddress: string
  name: string
  balance: {
    total: bigint
    currency: string
  }
  assetLockTxid: string | null
}

export default function Identities(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const { identities, loading, err } = useIdentities(status?.selectedWalletId ?? undefined)

  const mappedIdentities: Identity[] = identities.map((item) => ({
    walletAddress: item.identifier,
    name: item.alias ?? '',
    balance: {
      total: item.balance.amount,
      currency: 'Credits',
    },
    assetLockTxid: item.assetLockTxid ?? null,
  }))

  const assetsList = [
    {
      value: 'your-identities',
      label: 'Your Identities',
      content: (
        <div className={"flex flex-col gap-5"}>
          <div className={"flex flex-col gap-[.625rem] w-full"}>
            {loading && <ListSkeleton rows={5} />}
            {!loading && err && (
              <NoResults noResults={"Failed to load identities"} />
            )}
            {!loading && !err && mappedIdentities.length === 0 && (
              <div className={"flex flex-col items-center justify-center gap-4 py-12 text-center"}>
                <div className={"flex flex-col items-center gap-1"}>
                  <Text size={16} weight={"bold"} color={"brand"} className={"leading-[120%]"}>No identities yet</Text>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
                    Register a wallet-owned Platform identity from your Dash Core balance.
                  </Text>
                </div>
                <Button type={"button"} size={"sm"} onClick={() => navigate('/identities/register')}>Register identity</Button>
              </div>
            )}
            {!loading && !err && mappedIdentities.map((identity) => (
              <IdentityCard key={identity.walletAddress} identity={identity} />
            ))}
          </div>
        </div>
      )
    }
  ]

  return (
    <div className={"relative flex flex-col pb-12"}>
      <div className={"flex items-end justify-between gap-6 px-12 pt-2"}>
        <div className={"flex flex-col gap-3"}>
          <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Identities</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
            Manage your Dash Platform identities and their credit balances.
          </Text>
        </div>
        <Button type={"button"} size={"sm"} onClick={() => navigate('/identities/register')}>Register identity</Button>
      </div>
      <div className={"px-12 mt-8"}>
        <div className={"relative shadow-[8px_0_64px_0_rgba(12,28,51,0.08)] dash-card-base rounded-3xl p-[.9375rem]"}>
          <Tabs
            items={assetsList}
            value={'your-identities'}
            size={"xl"}
            triggerClassName={
              'data-[state=active]:text-dash-primary-dark-blue ' +
              'data-[state=inactive]:text-dash-primary-dark-blue/35 ' +
              'dark:data-[state=active]:text-white ' +
              'dark:data-[state=inactive]:text-white/35 ' +
              'font-medium tracking-[-0.03em]'
            }
          />
        </div>
      </div>
    </div>
  )
}
