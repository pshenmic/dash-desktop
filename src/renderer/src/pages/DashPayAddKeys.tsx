import AddKeys from '@renderer/components/pages/dashpay/addKeys/AddKeys'
import { useAuth } from '@renderer/contexts/AuthContext'

export default function DashPayAddKeysPage(): React.JSX.Element | null {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId
  if (walletId == null) return null
  return <AddKeys key={walletId} walletId={walletId} />
}
