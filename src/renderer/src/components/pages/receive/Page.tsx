import { useState } from "react";
import { Tabs } from "dash-ui-kit/react";
import { ReceivePageType } from "@renderer/constants";
import Header from "./Header";
import ReceiveAddressCard from "./ReceiveAddressCard";
import ShieldedReceiveCard from "./ShieldedReceiveCard";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useConnectionModeContext } from "@renderer/contexts/ConnectionModeContext";
import { API } from "@renderer/api";
import { useAsyncWithCache } from "@renderer/hooks/useAsyncWithCache";
import SyncGateNotice from "@renderer/components/ui/SyncGateNotice";

const selectedAsset = {
  id: 'dash',
  name: 'Dash',
  symbol: 'DASH',
  initials: 'D',
  currency: 'DASH',
}

const dashDescription = (
  <span>This is your <span className={"font-extrabold"}>Dash</span>{' '}
    receival address. You can use this address to send funds to your wallet. It is{' '}
    <span className={"font-extrabold"}>highly suggested to not reuse the same address</span>{' '}
    for full privacy. You can also create a new address.
  </span>
)

const shieldedDescription = (
  <span>This is your <span className={"font-extrabold"}>Shielded</span>{' '}
    receival address. Payments to it are fully private — sender, recipient and amount{' '}
    are <span className={"font-extrabold"}>hidden on-chain</span>, so it is safe to reuse this address.
  </span>
)

export default function Receive({pageData}: {pageData: ReceivePageType}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('dash')
  const { status } = useAuth()
  const { fallbackActive: syncIncomplete } = useConnectionModeContext()
  const walletId = status?.selectedWalletId ?? undefined
  const { data: address } = useAsyncWithCache<string | null>(
    'receiveAddress',
    syncIncomplete ? undefined : walletId,
    () => API.getReceiveAddress(walletId!),
    null,
    { errorMessage: 'Failed to load receive address' }
  )

  const tabItems = [
    {
      value: 'dash',
      label: pageData.tabs.dash,
      content: syncIncomplete
        ? <SyncGateNotice />
        : address
          ? <ReceiveAddressCard address={address} data={pageData.receiveAddressCard} />
          : <></>,
    },
    {
      value: 'shielded',
      label: pageData.tabs.shielded,
      content: <ShieldedReceiveCard walletId={walletId} />,
    },
  ]

  return (
    <div className={`relative flex flex-col pb-12`}>
        <Header data={{...pageData.header, description: activeTab === 'shielded' ? shieldedDescription : dashDescription}}
          selectedAsset={selectedAsset}
        />
        <div className={"px-12 mt-8"}>
          <Tabs
            items={tabItems}
            value={activeTab}
            onValueChange={setActiveTab}
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
  )
}
