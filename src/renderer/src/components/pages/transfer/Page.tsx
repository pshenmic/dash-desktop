import { useAssetSelector, PLATFORM_CREDITS_ASSET_ID } from "@renderer/hooks/useAssetSelector";
import { TransferPageType } from "@renderer/constants";
import Header from "./Header";
import CoreTransferForm from "./CoreTransferForm";
import PlatformTransferForm from "./PlatformTransferForm";

const PLATFORM_HEADER: TransferPageType['header'] = {
  title: 'Send',
  description: '',
  balance: 'Balance',
}

export default function TransferPage({pageData}: {pageData: TransferPageType}): React.JSX.Element {
  const { selectedAsset, assets, selectAsset } = useAssetSelector()
  const isPlatform = selectedAsset.id === PLATFORM_CREDITS_ASSET_ID
  const header = isPlatform ? PLATFORM_HEADER : {...pageData.header, description: ''}

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      <Header
        selectedAsset={selectedAsset}
        assets={assets}
        onSelectAsset={selectAsset}
        data={header}
      />
      {isPlatform
        ? <PlatformTransferForm pageData={{...pageData, header}} />
        : <CoreTransferForm pageData={{...pageData, header}} />}
    </div>
  )
}
