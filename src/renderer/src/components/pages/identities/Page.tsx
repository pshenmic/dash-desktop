import { refreshIdentities, useIdentities } from "@renderer/hooks/useIdentities";
import { useAuth } from "@renderer/contexts/AuthContext";
import IdentityCard from "./IdentityCard";
import NoResults from "@renderer/components/ui/NoResults";
import RetryButton from "@renderer/components/ui/RetryButton";
import { NoResultsTone } from "@renderer/enums/NoResultsTone";
import ListSkeleton from "@renderer/components/ui/Skeleton";
import PageHeader from "@renderer/components/ui/PageHeader";
import PageTabs from "@renderer/components/ui/PageTabs";
import { PAGE_HEADERS } from "@renderer/constants/pageHeaders";
import { SURFACE_PANEL } from "@renderer/constants/surfaces";
import { Button } from "@renderer/components/dash-ui-kit-extended";
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
  const walletId = status?.selectedWalletId ?? undefined
  const { identities, loading, err } = useIdentities(walletId)

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
              <NoResults
                tone={NoResultsTone.Error}
                noResults={"Failed to load identities"}
                action={walletId !== undefined && <RetryButton onRetry={() => refreshIdentities(walletId)} />}
              />
            )}
            {!loading && !err && mappedIdentities.length === 0 && (
              <NoResults
                title={"No identities yet"}
                action={<Button type={"button"} size={"compact"} colorScheme={"primary"} onClick={() => navigate('/identities/register')}>Register identity</Button>}
              />
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
      <div className={"px-12"}>
        <PageHeader
          title={PAGE_HEADERS.identities.title}
          subtitle={PAGE_HEADERS.identities.subtitle}
          actions={<Button type={"button"} size={"compact"} colorScheme={"primary"} onClick={() => navigate('/identities/register')}>Register identity</Button>}
        />
        <div className={`relative ${SURFACE_PANEL}`}>
          <PageTabs
            items={assetsList}
            value={'your-identities'}
          />
        </div>
      </div>
    </div>
  )
}
