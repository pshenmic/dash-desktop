import { Tabs } from "dash-ui-kit/react";
import {useState} from "react";
import { useIdentities } from "@renderer/hooks/useIdentities";
import { useAuth } from "@renderer/contexts/AuthContext";
import IdentityCard from "./IdentityCard";
import NoResults from "@renderer/components/ui/NoResults";
import ListSkeleton from "@renderer/components/ui/Skeleton";
import {Button, PlusIcon} from "@renderer/components/dash-ui-kit-enxtended";
import ImportIdentity from "@renderer/components/modal/ImportIdentity";
import {invalidateAsyncCache} from "@renderer/hooks/useAsyncWithCache";

export interface Identity {
  walletAddress: string
  name: string
  balance: {
    total: bigint
    currency: string
  }
  assetLockTxid: string | null
  isImported: boolean
}

export default function Identities(): React.JSX.Element {
  const { status } = useAuth()
  const [isImportOpen, setIsImportOpen] = useState(false)
  const { identities, loading, err } = useIdentities(status?.selectedWalletId ?? undefined)

  const mappedIdentities: Identity[] = identities.map((item) => ({
    walletAddress: item.identifier,
    name: item.alias ?? '',
    balance: {
      total: item.balance.amount,
      currency: 'Credits',
    },
    assetLockTxid: item.assetLockTxid ?? null,
    isImported: item.isImported,
  }))

  const assetsList = [
    {
      value: 'your-identities',
      label: 'Your Identities',
      content: (
        <div className={"flex flex-col gap-5"}>
          <div className={"flex justify-end"}>
            <Button
              type={"button"}
              onClick={() => setIsImportOpen(true)}
              disabled={!status?.selectedWalletId}
              colorScheme={"primary"}
              size={"sm"}
              className={"min-h-0! py-2! rounded-[.75rem]"}
            >
              <span className={"flex items-center gap-2"}>
                <PlusIcon size={10} color={"currentColor"} />
                Import identity
              </span>
            </Button>
          </div>
          <div className={"flex flex-col gap-[.625rem] w-full"}>
            {loading && <ListSkeleton rows={5} />}
            {!loading && err && (
              <NoResults noResults={"Failed to load identities"} />
            )}
            {!loading && !err && mappedIdentities.length === 0 && (
              <NoResults noResults={"No identities found"} />
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
    <div className={"w-full px-12 pb-12 "}>
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
      <ImportIdentity
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        walletId={status?.selectedWalletId ?? null}
        onImported={() => {
          if (status?.selectedWalletId) {
            invalidateAsyncCache('identities', status.selectedWalletId)
          }
        }}
      />
    </div>
  )
}
