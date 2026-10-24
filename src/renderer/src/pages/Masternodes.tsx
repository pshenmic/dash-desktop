import Masternodes from '@renderer/components/pages/masternodes/Page'
import { useAuth } from '@renderer/contexts/AuthContext'

export default function MasternodesPage(): React.JSX.Element | null {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId
  if (walletId == null) return null
  return <Masternodes key={walletId} walletId={walletId} />
}
