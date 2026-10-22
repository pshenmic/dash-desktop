import AddressList from '@renderer/components/pages/addresses/AddressList'
import PageHeader from '@renderer/components/ui/PageHeader'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'

export default function AddressesPage(): React.JSX.Element {
  const { title, subtitle } = PAGE_HEADERS.addresses
  const { syncIncomplete } = useConnectionModeContext()

  return (
    <div className={"flex flex-col"}>
      <div className={"px-12"}>
        <PageHeader title={title} subtitle={subtitle} />
      </div>
      <AddressList coreGated={syncIncomplete} />
    </div>
  )
}
