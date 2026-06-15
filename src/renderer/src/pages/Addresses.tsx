import { Heading, Text } from '@renderer/components/dash-ui-kit-enxtended'
import AddressList from '@renderer/components/pages/addresses/AddressList'
import SyncGateNotice from '@renderer/components/ui/SyncGateNotice'
import { addressesPage } from '@renderer/constants'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { renderBoldText } from '@renderer/utils/renderBoldText'

export default function AddressesPage(): React.JSX.Element {
  const { description, title } = addressesPage
  const { fallbackActive: syncIncomplete } = useConnectionModeContext()

  return (
    <div className={"flex flex-col"}>
      <Heading as={"h1"} size={"xl40"} weight={"medium"} color={"brand-white"} className={"tracking-[-0.03em] leading-[125%] px-12 mb-4.5"}>
        {title}
      </Heading>
      <Text size={14} weight={"medium"} color={"brand"} opacity={50} className={"px-12 mb-8"}>
        {renderBoldText(description)}
      </Text>
      {syncIncomplete
        ? <div className={"px-12"}><SyncGateNotice /></div>
        : <AddressList />}
    </div>
  )
}
