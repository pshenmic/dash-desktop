import { useAssetSelector, PLATFORM_CREDITS_ASSET_ID } from "@renderer/hooks/useAssetSelector";
import { TransferPageType } from "@renderer/constants";
import Header from "./Header";
import CoreTransferForm from "./CoreTransferForm";
import PlatformTransferForm from "./PlatformTransferForm";

const PLATFORM_HEADER: TransferPageType['header'] = {
  title: 'Send',
  description: 'Send Platform (L2) credits from one of your addresses to another.',
  balance: 'Balance',
}

export default function TransferPage({pageData}: {pageData: TransferPageType}): React.JSX.Element {
  const { selectedAsset, assets, selectAsset } = useAssetSelector()
  const isPlatform = selectedAsset.id === PLATFORM_CREDITS_ASSET_ID

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      <Header
        selectedAsset={selectedAsset}
        assets={assets}
        onSelectAsset={selectAsset}
        data={isPlatform ? PLATFORM_HEADER : pageData.header}
      />
      {isPlatform
        ? <PlatformTransferForm pageData={{...pageData, header: PLATFORM_HEADER}} />
        : <CoreTransferForm pageData={pageData} />}
    </div>
  )
}
