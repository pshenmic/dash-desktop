import { ReceivePageType } from "@renderer/constants";
import Header from "../transfer/Header";
import ReceiveAddressCard from "./ReceiveAddressCard";
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

export default function Receive({pageData}: {pageData: ReceivePageType}): React.JSX.Element {
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

  return (
    <div className={`relative flex flex-col pb-12`}>
        <Header data={{...pageData.header, description:
          <span>This is your <span className={"font-extrabold"}>Dash</span>{' '}
           receival address. You can use this address to send funds to your wallet. It is{' '}
           <span className={"font-extrabold"}>highly suggested to not reuse the same address</span>{' '}
           for full privacy. You can also create a new address.
           </span>}}
          selectedAsset={selectedAsset}
        />
        {syncIncomplete
          ? <div className={"px-12 mt-12"}><SyncGateNotice /></div>
          : address && <ReceiveAddressCard address={address} data={pageData.receiveAddressCard} />}
    </div>
  )
}
