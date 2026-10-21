import { Heading } from '@renderer/components/dash-ui-kit-enxtended'
import AddressList from '@renderer/components/pages/addresses/AddressList'
import { addressesPage } from '@renderer/constants'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'

export default function AddressesPage(): React.JSX.Element {
  const { title } = addressesPage
  const { syncIncomplete } = useConnectionModeContext()

  return (
    <div className={"flex flex-col"}>
      <Heading as={"h1"} size={"xl40"} weight={"medium"} color={"brand-white"} className={"tracking-[-0.03em] leading-[125%] px-12 mb-8"}>
        {title}
      </Heading>
      <AddressList coreGated={syncIncomplete} />
    </div>
  )
}
