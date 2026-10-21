import { useEffect, useState } from "react";
import { Tabs } from "dash-ui-kit/react";
import { RECEIVE_REFRESH_MS, ReceivePageType } from "@renderer/constants";
import Header from "./Header";
import ReceiveAddressCard from "./ReceiveAddressCard";
import ShieldedReceiveCard from "./ShieldedReceiveCard";
import PlatformReceiveCard from "./PlatformReceiveCard";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useConnectionModeContext } from "@renderer/contexts/ConnectionModeContext";
import { API } from "@renderer/api";
import { useAsyncWithCache } from "@renderer/hooks/useAsyncWithCache";
import { useAdresses } from "@renderer/hooks/useAdresses";
import { refreshBalance } from "@renderer/hooks/useWalletBalance";
import SyncGateNotice from "@renderer/components/ui/SyncGateNotice";

export default function Receive({pageData}: {pageData: ReceivePageType}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('core')
  const { status } = useAuth()
  const { syncIncomplete } = useConnectionModeContext()
  const walletId = status?.selectedWalletId ?? undefined
  const { data: address } = useAsyncWithCache<string | null>(
    'receiveAddress',
    syncIncomplete ? undefined : walletId,
    () => API.getReceiveAddress(walletId!),
    null,
    { errorMessage: 'Failed to load receive address' }
  )
  const { receiving } = useAdresses(
    syncIncomplete ? undefined : walletId,
    RECEIVE_REFRESH_MS,
  )

  useEffect(() => {
    if (walletId === undefined || syncIncomplete) return
    const timer = setInterval(() => {
      refreshBalance(walletId)
    }, RECEIVE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [syncIncomplete, walletId])

  const tabItems = [
    {
      value: 'core',
      label: pageData.tabs.core,
      content: syncIncomplete
        ? <SyncGateNotice />
        : address
          ? <ReceiveAddressCard addresses={receiving} defaultAddress={address} data={pageData.receiveAddressCard} />
          : <></>,
    },
    {
      value: 'platform',
      label: pageData.tabs.platform,
      content: <PlatformReceiveCard walletId={walletId} />,
    },
    {
      value: 'shielded',
      label: pageData.tabs.shielded,
      content: <ShieldedReceiveCard walletId={walletId} />,
    },
  ]

  return (
    <div className={`relative flex flex-col pb-12`}>
        <Header data={pageData.header} />
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
