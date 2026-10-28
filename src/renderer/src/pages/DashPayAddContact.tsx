import AddContact from '@renderer/components/pages/dashpay/addContact/AddContact'
import { useAuth } from '@renderer/contexts/AuthContext'

export default function DashPayAddContactPage(): React.JSX.Element | null {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId
  if (walletId == null) return null
  return <AddContact key={walletId} walletId={walletId} />
}
