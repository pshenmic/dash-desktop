import DashPay from '@renderer/components/pages/dashpay/Page'
import { useAuth } from '@renderer/contexts/AuthContext'

export default function DashPayPage(): React.JSX.Element | null {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId
  if (walletId == null) return null
  return <DashPay key={walletId} walletId={walletId} />
}
