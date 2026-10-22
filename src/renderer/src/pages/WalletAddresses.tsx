import { useNavigate } from 'react-router-dom'
import AddressList from '@renderer/components/pages/addresses/AddressList'
import PageHeader from '@renderer/components/ui/PageHeader'
import { ADDRESS_BOOK_ROUTES } from '@renderer/constants/addressBook'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'

export default function WalletAddressesPage(): React.JSX.Element {
  const { title, subtitle, back } = PAGE_HEADERS.walletAddresses
  const { syncIncomplete } = useConnectionModeContext()
  const navigate = useNavigate()

  return (
    <div className={"flex flex-col"}>
      <div className={"px-12"}>
        <PageHeader title={title} subtitle={subtitle} onBack={() => navigate(ADDRESS_BOOK_ROUTES.root)} backLabel={back} />
      </div>
      <AddressList coreGated={syncIncomplete} />
    </div>
  )
}
